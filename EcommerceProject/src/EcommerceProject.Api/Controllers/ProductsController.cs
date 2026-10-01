using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EcommerceProject.Api.Data;
using EcommerceProject.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceProject.Api.Controllers;

[ApiController]
[Authorize(Roles = "Merchant,PlatformAdmin")]
public sealed class ProductsController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("api/stores/{storeId:guid}/products")]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetProducts(
        Guid storeId, [FromQuery] string? search, [FromQuery] Guid? categoryId, CancellationToken cancellationToken)
    {
        if (!await CanAccessStoreAsync(storeId, cancellationToken)) return NotFound();
        var query = db.Products.AsNoTracking().Where(product => product.StoreId == storeId && product.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(product => product.Name.Contains(search) || product.SKU.Contains(search));
        if (categoryId.HasValue) query = query.Where(product => product.CategoryId == categoryId);
        var products = await query.OrderBy(product => product.Name).ToListAsync(cancellationToken);
        return Ok(products.Select(ToResponse).ToList());
    }

    [HttpPost("api/stores/{storeId:guid}/products")]
    public async Task<ActionResult<ProductResponse>> CreateProduct(
        Guid storeId, CreateProductRequest request, CancellationToken cancellationToken)
    {
        if (!await CanAccessStoreAsync(storeId, cancellationToken)) return NotFound();
        var validation = await ValidateProductInputAsync(storeId, request.CategoryId, request.SKU, null, cancellationToken);
        if (validation is not null) return validation;

        var product = new Product
        {
            StoreId = storeId,
            CategoryId = request.CategoryId,
            Name = request.Name.Trim(),
            Description = Clean(request.Description),
            SKU = request.SKU.Trim().ToUpperInvariant(),
            Price = request.Price,
            StockQuantity = request.StockQuantity
        };
        db.Products.Add(product);
        if (product.StockQuantity > 0)
        {
            db.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = product.Id,
                Type = InventoryTransactionType.InitialStock,
                QuantityChange = product.StockQuantity,
                Reference = "Product creation"
            });
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(product));
    }

    [HttpPut("api/products/{id:guid}")]
    public async Task<ActionResult<ProductResponse>> UpdateProduct(
        Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null || !await CanAccessStoreAsync(product.StoreId, cancellationToken)) return NotFound();
        var validation = await ValidateProductInputAsync(product.StoreId, request.CategoryId, request.SKU, id, cancellationToken);
        if (validation is not null) return validation;

        product.CategoryId = request.CategoryId;
        product.Name = request.Name.Trim();
        product.Description = Clean(request.Description);
        product.SKU = request.SKU.Trim().ToUpperInvariant();
        product.Price = request.Price;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(product));
    }

    [HttpPost("api/products/{id:guid}/image")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ProductResponse>> UploadImage(Guid id, IFormFile image, CancellationToken cancellationToken)
    {
        var product = await db.Products.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null || !await CanAccessStoreAsync(product.StoreId, cancellationToken)) return NotFound();
        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        if (image.Length == 0 || !allowed.Contains(image.ContentType, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "Use a JPG, PNG, or WebP image." });

        var uploads = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "products");
        Directory.CreateDirectory(uploads);
        var extension = Path.GetExtension(image.FileName).ToLowerInvariant();
        var fileName = $"{product.Id:N}-{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploads, fileName);
        await using (var stream = System.IO.File.Create(filePath)) await image.CopyToAsync(stream, cancellationToken);
        product.ImageUrl = $"/uploads/products/{fileName}";
        product.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(product));
    }

    [HttpPatch("api/products/{id:guid}/inventory")]
    public async Task<ActionResult<ProductResponse>> AdjustInventory(
        Guid id, AdjustInventoryRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null || !await CanAccessStoreAsync(product.StoreId, cancellationToken)) return NotFound();
        var newQuantity = product.StockQuantity + request.QuantityChange;
        if (newQuantity < 0)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.QuantityChange)] = ["Stock cannot be reduced below zero."]
            }));
        }

        product.StockQuantity = newQuantity;
        product.UpdatedAt = DateTimeOffset.UtcNow;
        db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = product.Id,
            Type = InventoryTransactionType.ManualAdjustment,
            QuantityChange = request.QuantityChange,
            Reference = Clean(request.Reference)
        });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(product));
    }

    private async Task<ActionResult?> ValidateProductInputAsync(
        Guid storeId, Guid? categoryId, string sku, Guid? productId, CancellationToken cancellationToken)
    {
        if (categoryId.HasValue && !await db.Categories.AnyAsync(category =>
            category.Id == categoryId && category.StoreId == storeId && category.IsActive, cancellationToken))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(categoryId)] = ["Choose an active category from this store."]
            }));
        }
        var normalizedSku = sku.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(product => product.StoreId == storeId && product.SKU == normalizedSku && product.Id != productId, cancellationToken))
        {
            return Conflict(new { message = "That SKU is already used by another product in this store." });
        }
        return null;
    }

    private async Task<bool> CanAccessStoreAsync(Guid storeId, CancellationToken cancellationToken)
    {
        if (User.IsInRole("PlatformAdmin")) return await db.Stores.AnyAsync(store => store.Id == storeId, cancellationToken);
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return userId is not null && await db.Stores.AnyAsync(store => store.Id == storeId && store.MerchantId == userId, cancellationToken);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static ProductResponse ToResponse(Product product) => new(
        product.Id, product.StoreId, product.CategoryId, product.Name, product.Description, product.ImageUrl,
        product.SKU, product.Price, product.StockQuantity, product.IsActive, product.UpdatedAt);
}

public sealed class CreateProductRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(4000)] public string? Description { get; set; }
    [Required, StringLength(80, MinimumLength = 1)] public string SKU { get; set; } = string.Empty;
    [Range(typeof(decimal), "0.01", "9999999999999999")] public decimal Price { get; set; }
    [Range(0, int.MaxValue)] public int StockQuantity { get; set; }
    public Guid? CategoryId { get; set; }
}

public sealed class UpdateProductRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(4000)] public string? Description { get; set; }
    [Required, StringLength(80, MinimumLength = 1)] public string SKU { get; set; } = string.Empty;
    [Range(typeof(decimal), "0.01", "9999999999999999")] public decimal Price { get; set; }
    public Guid? CategoryId { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class AdjustInventoryRequest
{
    [Range(-int.MaxValue, int.MaxValue)] public int QuantityChange { get; set; }
    [StringLength(200)] public string? Reference { get; set; }
}

public sealed record ProductResponse(
    Guid Id, Guid StoreId, Guid? CategoryId, string Name, string? Description, string? ImageUrl,
    string SKU, decimal Price, int StockQuantity, bool IsActive, DateTimeOffset UpdatedAt);

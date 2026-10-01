using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EcommerceProject.Api.Data;
using EcommerceProject.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceProject.Api.Controllers;

[ApiController]
[Route("api/stores/{storeId:guid}/categories")]
[Authorize(Roles = "Merchant,PlatformAdmin")]
public sealed class CategoriesController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> GetCategories(Guid storeId, CancellationToken cancellationToken)
    {
        if (!await CanAccessStoreAsync(storeId, cancellationToken)) return NotFound();
        var categories = await db.Categories.AsNoTracking()
            .Where(category => category.StoreId == storeId && category.IsActive)
            .OrderBy(category => category.Name)
            .ToListAsync(cancellationToken);
        return Ok(categories.Select(ToResponse).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<CategoryResponse>> CreateCategory(
        Guid storeId, CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!await CanAccessStoreAsync(storeId, cancellationToken)) return NotFound();
        var name = request.Name.Trim();
        if (await db.Categories.AnyAsync(category => category.StoreId == storeId && category.Name == name, cancellationToken))
        {
            return Conflict(new { message = "A category with that name already exists in this store." });
        }

        var category = new Category { StoreId = storeId, Name = name, Description = Clean(request.Description) };
        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(category));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> UpdateCategory(
        Guid storeId, Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!await CanAccessStoreAsync(storeId, cancellationToken)) return NotFound();
        var category = await db.Categories.SingleOrDefaultAsync(
            item => item.Id == id && item.StoreId == storeId, cancellationToken);
        if (category is null) return NotFound();

        var name = request.Name.Trim();
        if (await db.Categories.AnyAsync(item => item.Id != id && item.StoreId == storeId && item.Name == name, cancellationToken))
        {
            return Conflict(new { message = "A category with that name already exists in this store." });
        }

        category.Name = name;
        category.Description = Clean(request.Description);
        category.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(category));
    }

    private async Task<bool> CanAccessStoreAsync(Guid storeId, CancellationToken cancellationToken)
    {
        if (User.IsInRole("PlatformAdmin")) return await db.Stores.AnyAsync(store => store.Id == storeId, cancellationToken);
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return userId is not null && await db.Stores.AnyAsync(
            store => store.Id == storeId && store.MerchantId == userId, cancellationToken);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static CategoryResponse ToResponse(Category category) =>
        new(category.Id, category.StoreId, category.Name, category.Description, category.IsActive);
}

public sealed class CreateCategoryRequest
{
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(500)] public string? Description { get; set; }
}

public sealed class UpdateCategoryRequest
{
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(500)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed record CategoryResponse(Guid Id, Guid StoreId, string Name, string? Description, bool IsActive);

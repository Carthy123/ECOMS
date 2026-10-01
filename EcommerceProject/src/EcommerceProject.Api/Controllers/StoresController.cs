using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EcommerceProject.Api.Data;
using EcommerceProject.Api.Models;
using EcommerceProject.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceProject.Api.Controllers;

[ApiController]
[Route("api/stores")]
[Authorize(Roles = "Merchant,PlatformAdmin")]
public sealed class StoresController(
    ApplicationDbContext db,
    StoreSlugService slugService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreResponse>>> GetStores(CancellationToken cancellationToken)
    {
        var query = db.Stores.AsNoTracking();
        if (!User.IsInRole("PlatformAdmin"))
        {
            query = query.Where(store => store.MerchantId == CurrentUserId());
        }

        var stores = await query.OrderBy(store => store.Name)
            .ToListAsync(cancellationToken);
        return Ok(stores.Select(ToResponse).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StoreResponse>> GetStore(Guid id, CancellationToken cancellationToken)
    {
        var store = await FindAuthorizedStoreAsync(id, cancellationToken);
        return store is null ? NotFound() : Ok(ToResponse(store));
    }

    [HttpPost]
    public async Task<ActionResult<StoreResponse>> CreateStore(
        CreateStoreRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var slug = slugService.CreateSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);

        if (!slugService.IsValid(slug))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Slug)] = ["Use lowercase letters, numbers, and single hyphens between words."]
            }));
        }

        if (await db.Stores.AnyAsync(store => store.Slug == slug, cancellationToken))
        {
            return Conflict(new { message = "That store URL is already in use. Choose another name or URL." });
        }

        var store = new Store
        {
            MerchantId = CurrentUserId(),
            Name = name,
            Slug = slug,
            Description = CleanOptional(request.Description),
            Email = CleanOptional(request.Email),
            PhoneNumber = CleanOptional(request.PhoneNumber)
        };

        db.Stores.Add(store);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetStore), new { id = store.Id }, ToResponse(store));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StoreResponse>> UpdateStore(
        Guid id,
        UpdateStoreRequest request,
        CancellationToken cancellationToken)
    {
        var store = await FindAuthorizedStoreAsync(id, cancellationToken);
        if (store is null)
        {
            return NotFound();
        }

        var name = request.Name.Trim();
        var slug = slugService.CreateSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
        if (!slugService.IsValid(slug))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Slug)] = ["Use lowercase letters, numbers, and single hyphens between words."]
            }));
        }

        if (await db.Stores.AnyAsync(existing => existing.Id != id && existing.Slug == slug, cancellationToken))
        {
            return Conflict(new { message = "That store URL is already in use. Choose another name or URL." });
        }

        store.Name = name;
        store.Slug = slug;
        store.Description = CleanOptional(request.Description);
        store.Email = CleanOptional(request.Email);
        store.PhoneNumber = CleanOptional(request.PhoneNumber);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(store));
    }

    private async Task<Store?> FindAuthorizedStoreAsync(Guid id, CancellationToken cancellationToken)
    {
        var query = db.Stores.Where(store => store.Id == id);
        if (!User.IsInRole("PlatformAdmin"))
        {
            query = query.Where(store => store.MerchantId == CurrentUserId());
        }

        return await query.SingleOrDefaultAsync(cancellationToken);
    }

    private string CurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Authenticated user identifier is missing.");

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static StoreResponse ToResponse(Store store) => new(
        store.Id, store.Name, store.Slug, store.Description, store.Email,
        store.PhoneNumber, store.Status.ToString(), store.CreatedAt);
}

public sealed class CreateStoreRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(120)] public string? Slug { get; set; }
    [StringLength(2000)] public string? Description { get; set; }
    [EmailAddress, StringLength(320)] public string? Email { get; set; }
    [StringLength(40)] public string? PhoneNumber { get; set; }
}

public sealed class UpdateStoreRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(120)] public string? Slug { get; set; }
    [StringLength(2000)] public string? Description { get; set; }
    [EmailAddress, StringLength(320)] public string? Email { get; set; }
    [StringLength(40)] public string? PhoneNumber { get; set; }
}

public sealed record StoreResponse(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? Email,
    string? PhoneNumber,
    string Status,
    DateTimeOffset CreatedAt);

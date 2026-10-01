namespace EcommerceProject.Api.Models;

public sealed class Store
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string MerchantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public StoreStatus Status { get; set; } = StoreStatus.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum StoreStatus
{
    Draft,
    Active,
    Suspended
}

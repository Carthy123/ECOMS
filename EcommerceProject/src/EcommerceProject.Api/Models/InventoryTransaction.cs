namespace EcommerceProject.Api.Models;

public sealed class InventoryTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public InventoryTransactionType Type { get; set; }
    public int QuantityChange { get; set; }
    public string? Reference { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum InventoryTransactionType
{
    InitialStock,
    ManualAdjustment,
    Sale,
    Reversal
}

namespace EcommerceProject.Api.Models;

public sealed class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<OrderItem> Items { get; set; } = [];
}

public enum OrderStatus
{
    Pending,
    Confirmed,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}

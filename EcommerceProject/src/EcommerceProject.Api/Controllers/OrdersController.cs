using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EcommerceProject.Api.Data;
using EcommerceProject.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceProject.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("/api/stores/{storeId:guid}/customers")]
    [Authorize(Roles = "Merchant,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<CustomerSummary>>> GetCustomers(Guid storeId, CancellationToken cancellationToken)
    {
        var storeQuery = db.Stores.Where(store => store.Id == storeId);
        if (!User.IsInRole("PlatformAdmin"))
        {
            var merchantId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            storeQuery = storeQuery.Where(store => store.MerchantId == merchantId);
        }

        if (!await storeQuery.AnyAsync(cancellationToken)) return NotFound();

        var orders = await db.Orders.AsNoTracking()
            .Where(order => order.StoreId == storeId)
            .ToListAsync(cancellationToken);

        var customers = orders.GroupBy(order => order.CustomerEmail.ToLower())
            .Select(group => new CustomerSummary(
                group.First().CustomerName,
                group.Key,
                group.Count(),
                group.Sum(order => order.Total),
                group.Max(order => order.CreatedAt)))
            .OrderByDescending(customer => customer.LastOrderAt)
            .ToList();

        return Ok(customers);
    }

    [HttpGet("store/{storeId:guid}")]
    [Authorize(Roles = "Merchant,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<OrderSummary>>> GetForStore(Guid storeId, CancellationToken cancellationToken)
    {
        var storeQuery = db.Stores.Where(store => store.Id == storeId);
        if (!User.IsInRole("PlatformAdmin"))
        {
            var merchantId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            storeQuery = storeQuery.Where(store => store.MerchantId == merchantId);
        }

        if (!await storeQuery.AnyAsync(cancellationToken)) return NotFound();

        var orders = await db.Orders.AsNoTracking()
            .Where(order => order.StoreId == storeId)
            .Include(order => order.Items)
            .ToListAsync(cancellationToken);

        return Ok(orders.OrderByDescending(order => order.CreatedAt).Select(order => new OrderSummary(
            order.Id,
            order.CustomerName,
            order.CustomerEmail,
            order.DeliveryAddress,
            order.Total,
            order.Status.ToString(),
            order.CreatedAt,
            order.Items.Select(item => new OrderLine(item.ProductName, item.Quantity, item.UnitPrice)).ToList())).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<OrderResponse>> Create(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Stores.AnyAsync(store => store.Id == request.StoreId, cancellationToken)) return NotFound(new { message = "Store not found." });
        if (request.Items.Count == 0) return BadRequest(new { message = "Your cart is empty." });

        var productIds = request.Items.Select(item => item.ProductId).Distinct().ToList();
        var products = await db.Products.Where(product => product.StoreId == request.StoreId && product.IsActive && productIds.Contains(product.Id)).ToDictionaryAsync(product => product.Id, cancellationToken);
        var order = new Order { StoreId = request.StoreId, CustomerName = request.CustomerName.Trim(), CustomerEmail = request.CustomerEmail.Trim().ToLowerInvariant(), DeliveryAddress = request.DeliveryAddress.Trim() };
        foreach (var requested in request.Items)
        {
            if (!products.TryGetValue(requested.ProductId, out var product)) return BadRequest(new { message = "One of the products is no longer available." });
            if (requested.Quantity < 1 || requested.Quantity > product.StockQuantity) return BadRequest(new { message = $"Not enough stock for {product.Name}." });
            order.Items.Add(new OrderItem { OrderId = order.Id, ProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price, Quantity = requested.Quantity });
            product.StockQuantity -= requested.Quantity;
            product.UpdatedAt = DateTimeOffset.UtcNow;
            order.Total += product.Price * requested.Quantity;
        }
        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new OrderResponse(order.Id, order.Status.ToString(), order.Total, order.CreatedAt));
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Merchant,PlatformAdmin")]
    public async Task<ActionResult<OrderResponse>> UpdateStatus(Guid id, UpdateOrderStatusRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<OrderStatus>(request.Status, true, out var status))
        {
            return BadRequest(new { message = "Choose a valid order status." });
        }

        var orderQuery = db.Orders.Where(order => order.Id == id);
        if (!User.IsInRole("PlatformAdmin"))
        {
            var merchantId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            orderQuery = orderQuery.Where(order => db.Stores.Any(store => store.Id == order.StoreId && store.MerchantId == merchantId));
        }

        var order = await orderQuery.SingleOrDefaultAsync(cancellationToken);
        if (order is null) return NotFound(new { message = "Order not found." });

        order.Status = status;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new OrderResponse(order.Id, order.Status.ToString(), order.Total, order.CreatedAt));
    }
}

public sealed class CreateOrderRequest
{
    [Required] public Guid StoreId { get; set; }
    [Required, StringLength(200, MinimumLength = 2)] public string CustomerName { get; set; } = string.Empty;
    [Required, EmailAddress] public string CustomerEmail { get; set; } = string.Empty;
    [Required, StringLength(1000, MinimumLength = 5)] public string DeliveryAddress { get; set; } = string.Empty;
    [Required, MinLength(1)] public List<CreateOrderItemRequest> Items { get; set; } = [];
}

public sealed class CreateOrderItemRequest
{
    [Required] public Guid ProductId { get; set; }
    [Range(1, 999)] public int Quantity { get; set; }
}

public sealed class UpdateOrderStatusRequest
{
    [Required] public string Status { get; set; } = string.Empty;
}

public sealed record OrderResponse(Guid Id, string Status, decimal Total, DateTimeOffset CreatedAt);
public sealed record OrderSummary(Guid Id, string CustomerName, string CustomerEmail, string DeliveryAddress, decimal Total, string Status, DateTimeOffset CreatedAt, IReadOnlyList<OrderLine> Items);
public sealed record OrderLine(string ProductName, int Quantity, decimal UnitPrice);
public sealed record CustomerSummary(string Name, string Email, int OrderCount, decimal TotalSpent, DateTimeOffset LastOrderAt);

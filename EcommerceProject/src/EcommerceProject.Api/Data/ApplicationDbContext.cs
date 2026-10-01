using EcommerceProject.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace EcommerceProject.Api.Data;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Store>(entity =>
        {
            entity.HasKey(store => store.Id);
            entity.Property(store => store.Name).HasMaxLength(200).IsRequired();
            entity.Property(store => store.Slug).HasMaxLength(120).IsRequired();
            entity.Property(store => store.Description).HasMaxLength(2000);
            entity.Property(store => store.Email).HasMaxLength(320);
            entity.Property(store => store.PhoneNumber).HasMaxLength(40);
            entity.Property(store => store.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(store => store.Slug).IsUnique();
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(category => category.Id);
            entity.Property(category => category.Name).HasMaxLength(120).IsRequired();
            entity.Property(category => category.Description).HasMaxLength(500);
            entity.HasIndex(category => new { category.StoreId, category.Name }).IsUnique();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(product => product.Id);
            entity.Property(product => product.Name).HasMaxLength(200).IsRequired();
            entity.Property(product => product.Description).HasMaxLength(4000);
            entity.Property(product => product.ImageUrl).HasMaxLength(500);
            entity.Property(product => product.SKU).HasMaxLength(80).IsRequired();
            entity.Property(product => product.Price).HasPrecision(18, 2);
            entity.HasIndex(product => new { product.StoreId, product.SKU }).IsUnique();
            entity.HasIndex(product => new { product.StoreId, product.IsActive });
        });

        modelBuilder.Entity<InventoryTransaction>(entity =>
        {
            entity.HasKey(transaction => transaction.Id);
            entity.Property(transaction => transaction.Type).HasConversion<string>().HasMaxLength(30);
            entity.Property(transaction => transaction.Reference).HasMaxLength(200);
            entity.HasIndex(transaction => new { transaction.ProductId, transaction.CreatedAt });
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(order => order.Id);
            entity.Property(order => order.CustomerName).HasMaxLength(200).IsRequired();
            entity.Property(order => order.CustomerEmail).HasMaxLength(320).IsRequired();
            entity.Property(order => order.DeliveryAddress).HasMaxLength(1000).IsRequired();
            entity.Property(order => order.Total).HasPrecision(18, 2);
            entity.Property(order => order.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(order => new { order.StoreId, order.CreatedAt });
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(item => item.UnitPrice).HasPrecision(18, 2);
            entity.HasIndex(item => item.OrderId);
        });
    }
}

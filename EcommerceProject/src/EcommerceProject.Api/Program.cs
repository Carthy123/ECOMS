using System.Text;
using EcommerceProject.Api.Models;
using EcommerceProject.Api.Data;
using EcommerceProject.Api.Security;
using EcommerceProject.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
}

builder.Services.AddControllers();
var frontendOrigin = builder.Configuration["Frontend:Origin"] ?? "http://127.0.0.1:5173";
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(frontendOrigin, "http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var provider = builder.Configuration["Database:Provider"] ?? "SqlServer";
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("DefaultConnection is required.");

    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        options.UseSqlite(connectionString);
    }
    else
    {
        options.UseSqlServer(connectionString);
    }
});
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
    })
    .AddRoles<IdentityRole>()
    .AddSignInManager<SignInManager<ApplicationUser>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException("Jwt configuration is required.");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddSingleton<StoreSlugService>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ecommerce-api" }))
    .WithName("HealthCheck");

using (var scope = app.Services.CreateScope())
{
    try
    {
        if (app.Environment.IsDevelopment())
        {
            var database = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = app.Configuration["Database:Provider"] ?? "SqlServer";
            if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                await database.Database.EnsureCreatedAsync();
                var imageColumnExists = await database.Database.SqlQueryRaw<int>(
                    "SELECT COUNT(*) AS Value FROM pragma_table_info('Products') WHERE name = 'ImageUrl'").SingleAsync();
                if (imageColumnExists == 0)
                {
                    await database.Database.ExecuteSqlRawAsync("ALTER TABLE Products ADD COLUMN ImageUrl TEXT NULL");
                }
                await database.Database.ExecuteSqlRawAsync("""
                    CREATE TABLE IF NOT EXISTS Orders (
                        Id TEXT NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
                        StoreId TEXT NOT NULL,
                        CustomerName TEXT NOT NULL,
                        CustomerEmail TEXT NOT NULL,
                        DeliveryAddress TEXT NOT NULL,
                        Total TEXT NOT NULL,
                        Status TEXT NOT NULL,
                        CreatedAt TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS IX_Orders_StoreId_CreatedAt ON Orders (StoreId, CreatedAt);
                    CREATE TABLE IF NOT EXISTS OrderItems (
                        Id TEXT NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
                        OrderId TEXT NOT NULL,
                        ProductId TEXT NOT NULL,
                        ProductName TEXT NOT NULL,
                        UnitPrice TEXT NOT NULL,
                        Quantity INTEGER NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS IX_OrderItems_OrderId ON OrderItems (OrderId);
                    """);
            }
            else
            {
                await database.Database.MigrateAsync();
            }
        }

        await IdentitySeeder.SeedRolesAsync(scope.ServiceProvider);
    }
    catch (Exception) when (app.Environment.IsDevelopment())
    {
        Console.WriteLine("Development warning: the database is unavailable. The API will still start so Swagger and non-database endpoints can be inspected.");
    }
}

app.Run();

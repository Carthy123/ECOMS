using Microsoft.AspNetCore.Identity;

namespace EcommerceProject.Api.Data;

public static class IdentitySeeder
{
    public const string AdminRole = "PlatformAdmin";
    public const string MerchantRole = "Merchant";

    public static async Task SeedRolesAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in new[] { AdminRole, MerchantRole })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(role));
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Unable to create required identity role '{role}': " +
                        string.Join(", ", result.Errors.Select(error => error.Description)));
                }
            }
        }
    }
}

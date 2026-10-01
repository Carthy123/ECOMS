using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EcommerceProject.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EcommerceProject.Api.Security;

public sealed class JwtTokenService(IOptions<JwtOptions> options, UserManager<ApplicationUser> userManager)
{
    private readonly JwtOptions _options = options.Value;

    public async Task<string> CreateAccessTokenAsync(ApplicationUser user)
    {
        if (string.IsNullOrWhiteSpace(_options.Key) || _options.Key.Length < 32)
        {
            throw new InvalidOperationException("Jwt:Key must be configured with at least 32 characters outside source control.");
        }

        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email ?? string.Empty)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
            SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var token = new JwtSecurityToken(_options.Issuer, _options.Audience, claims,
            expires: expires, signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

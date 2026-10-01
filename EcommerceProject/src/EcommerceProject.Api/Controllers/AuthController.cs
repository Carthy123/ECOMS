using EcommerceProject.Api.Data;
using EcommerceProject.Api.Models;
using EcommerceProject.Api.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceProject.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    JwtTokenService tokenService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email.Trim().ToLowerInvariant(),
            Email = request.Email.Trim().ToLowerInvariant(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim()
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return ValidationProblem(new ValidationProblemDetails(
                result.Errors.GroupBy(error => error.Code)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray())));
        }

        await userManager.AddToRoleAsync(user, IdentitySeeder.MerchantRole);
        return Ok(new AuthResponse(await tokenService.CreateAccessTokenAsync(user), user.Email!));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        return Ok(new AuthResponse(await tokenService.CreateAccessTokenAsync(user), user.Email!));
    }
}

public sealed record RegisterRequest(string Email, string Password, string FirstName, string LastName);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string AccessToken, string Email);

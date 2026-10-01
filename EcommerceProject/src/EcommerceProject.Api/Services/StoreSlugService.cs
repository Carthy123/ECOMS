using System.Text;
using System.Text.RegularExpressions;

namespace EcommerceProject.Api.Services;

public sealed partial class StoreSlugService
{
    public string CreateSlug(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();

        foreach (var character in normalized)
        {
            if (char.GetUnicodeCategory(character) == System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(char.IsLetterOrDigit(character) ? character : '-');
        }

        return MultipleHyphens().Replace(builder.ToString(), "-").Trim('-');
    }

    public bool IsValid(string slug) => SlugPattern().IsMatch(slug);

    [GeneratedRegex("-+")]
    private static partial Regex MultipleHyphens();

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}

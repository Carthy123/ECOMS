# Ecommerce Project

Multi-merchant ecommerce platform based on `Ecommerce_Project_Full_Documentation.docx`.

## Current foundation

- `src/EcommerceProject.Api`: ASP.NET Core Web API targeting .NET 8
- SQL Server connection configured for `EcommerceProjectDB`
- Entity Framework Core `ApplicationDbContext`
- Initial `Store` model with a unique public slug
- ASP.NET Core Identity with Merchant and PlatformAdmin roles
- JWT bearer authentication with short-lived access tokens
- Merchant store management with ownership protection and friendly slug generation
- Product and category management with SKU and stock validation
- Inventory adjustment history for traceable stock changes
- Initial React/Vite merchant dashboard interface
- Typed frontend API client with environment-based API URL and JWT session helpers
- Merchant login and registration screen with friendly validation and demo preview mode
- OpenAPI and `/health` endpoint

The implementation follows the documented MVP sequence. Configure `Jwt:Key` with a secret of at least 32 characters using user secrets or environment configuration before running the API. Merchant registration is available at `POST /api/auth/register`; login is available at `POST /api/auth/login`. Authenticated merchants can manage stores through `GET/POST /api/stores` and `GET/PUT /api/stores/{id}`.

## Usability principles

- Store URLs are generated automatically from the store name when the merchant leaves the slug blank.
- API responses use clear validation and conflict messages suitable for inline form feedback.
- Merchant queries are tenant-scoped so a merchant sees only their own stores.
- The store workflow keeps the initial form focused on essential information, leaving catalogue and payment setup for later steps.
- Product management supports search, category filtering, stock adjustments, and deactivation without deleting historical records.
- The dashboard prioritizes quick scanning: key metrics, setup progress, sales trend, low-stock visibility, and product search are visible together.

## Run the web dashboard

```powershell
cd src/EcommerceProject.Web
npm install
npm run dev
```

The web client reads `VITE_API_BASE_URL` from `.env`; copy `.env.example` to `.env` when running the API on a different address. The dashboard is currently preview-first, while the API client is ready for the next authentication and real-data UI slice.

## Run the API

```powershell
dotnet restore EcommerceProject.slnx
dotnet run --project src/EcommerceProject.Api
```

Update the connection string in `src/EcommerceProject.Api/appsettings.json` or user secrets for a different SQL Server instance.

## Apply the database migration

After SQL Server is available, apply the checked-in schema with:

```powershell
dotnet ef database update --project src/EcommerceProject.Api --startup-project src/EcommerceProject.Api
```

The initial migration creates the ASP.NET Core Identity tables and the Stores table with a unique public slug.

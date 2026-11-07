---
name: flask-backend
description: Build, modify, debug, and review the Lan Yen Pharmacy backend using Flask, SQLAlchemy, PostgreSQL, JWT, and Marshmallow. Use when implementing API routes, controllers, services, repositories, models, schemas, authentication, authorization, database operations, security, or backend business logic.
---

# Flask Backend Skill - Lan Yen Pharmacy

## 1. Role

Act as a senior Python Flask backend developer.

Your responsibilities:

- Implement reliable backend functionality.
- Maintain the existing project architecture.
- Keep API behavior consistent with frontend requirements.
- Protect business rules and database integrity.
- Write readable, maintainable, and testable code.
- Avoid unnecessary abstractions and overengineering.
- Apply appropriate security practices throughout backend development.

## 2. Required Project Context

Before modifying backend code, read:

1. `AGENTS.md`
2. `.agents/skills/pharmacy-project/SKILL.md`
3. Relevant backend source files.
4. Related database models and migrations.
5. Relevant frontend API integration code when necessary.

Do not assume that a feature or endpoint already exists without inspecting the project.

## 3. Technology Stack

The approved backend stack is:

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Migrate
- PostgreSQL
- Flask-CORS
- Flask-JWT-Extended
- Marshmallow
- python-dotenv

Do not introduce another framework, ORM, database, or major dependency without approval.

## 4. Backend Architecture

Follow the existing backend structure:

```text
backend/
├── app/
│   ├── config/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── schemas/
│   ├── utils/
│   ├── __init__.py
│   └── extensions.py
├── migrations/
├── tests/
├── .env
├── requirements.txt
└── run.py
```

### Responsibilities

**routes/**

- Define API endpoints.
- Receive HTTP requests.
- Apply appropriate authentication and authorization decorators.
- Forward requests to controllers.
- Return HTTP responses.

**controllers/**

- Coordinate request handling.
- Read validated input.
- Call appropriate services.
- Format responses.
- Avoid placing complex business logic here.

**services/**

- Implement business rules and workflows.
- Coordinate repositories when multiple data operations are needed.
- Handle business-level validation.
- Manage transaction boundaries where appropriate.

**repositories/**

- Encapsulate database queries and persistence operations.
- Avoid duplicating query logic.
- Keep database access separate from HTTP handling.

**models/**

- Define SQLAlchemy models.
- Map Python attributes to the approved PostgreSQL schema.
- Define relationships when supported by the actual schema.

**schemas/**

- Validate and serialize request and response data using Marshmallow.
- Keep validation consistent with actual business requirements.

**utils/**

- Store genuinely reusable utilities.
- Avoid placing unrelated business logic in utility modules.

Use these layers when they provide meaningful separation. Do not create unnecessary files or classes for trivial operations.

## 5. Database Rules

- Use PostgreSQL as the database.
- Use SQLAlchemy for database operations.
- Use Flask-Migrate for schema migrations.
- Follow the approved 15-table database design.
- Inspect existing models before creating or modifying database code.
- Preserve primary keys, foreign keys, data types, nullability, uniqueness, and defaults.
- Do not rename or remove existing columns without approval.
- Do not create additional tables or columns without approval.
- Do not add inventory history tables.
- Do not add unapproved CHECK constraints.
- Do not modify the database schema merely to simplify implementation.

When a database change is genuinely necessary:

1. Explain why the change is needed.
2. Identify the affected tables and fields.
3. Wait for approval.
4. Implement the migration only after approval.

## 6. API Development

For every API endpoint:

1. Identify its purpose.
2. Identify the intended user role.
3. Determine the request method and input format.
4. Inspect existing API conventions.
5. Validate input data.
6. Apply authentication and authorization where required.
7. Execute business logic through the appropriate layer.
8. Return a consistent response.
9. Handle expected errors.

Do not invent API endpoints, response fields, status codes, or business behavior without checking requirements.

Use appropriate HTTP methods:

- GET: retrieve data.
- POST: create or execute an operation.
- PUT/PATCH: update data.
- DELETE: delete data when permitted by business requirements.

## 7. Authentication and Authorization

Use Flask-JWT-Extended for JWT functionality.

Requirements:

- Protect private endpoints.
- Verify authenticated users on the backend.
- Enforce permissions based on approved user roles.
- Never rely solely on frontend role checks.
- Do not expose passwords, secrets, or sensitive authentication information.
- Do not invent authentication flows that have not been approved.
- Verify resource ownership and access permissions when users access individual records.
- Prevent users from accessing or modifying another user's data without authorization.
- Do not allow users to modify protected fields such as roles or account status unless explicitly authorized.

## 8. Business Logic

Business rules must follow the approved Lan Yến Pharmacy requirements.

Important restrictions:

- Do not invent medicine pricing rules.
- Do not invent discount calculation rules.
- Do not invent loyalty point rules.
- Do not invent order cancellation rules.
- Do not invent inventory adjustment rules.
- Do not invent promotion eligibility rules.
- Do not invent employee assignment rules.
- Do not invent additional role permissions.

If a requirement is unclear, ask before implementing it.

## 9. Validation and Error Handling

- Validate user input before database operations.
- Use Marshmallow where appropriate.
- Check required fields and nullable fields against the approved schema.
- Handle missing records.
- Handle invalid input.
- Handle database errors appropriately.
- Return useful error messages without exposing internal stack traces.
- Avoid silently ignoring failed operations.
- Validate data types, lengths, formats, and allowed values.
- Explicitly define which fields a user is allowed to create or modify.
- Do not trust data simply because it was validated on the frontend.

Do not duplicate the same validation logic across multiple layers without a reason.

## 10. Database Transactions

- Keep related database operations consistent.
- Use transactions when multiple operations must succeed or fail together.
- Commit only when the operation is ready to persist.
- Roll back when a transaction fails.
- Avoid leaving partially completed operations.
- Do not expose raw database exceptions to API clients.

## 11. Security

Follow secure backend development practices. Apply security checks consistently across routes, controllers, services, repositories, models, and schemas.

### 11.1. Security Principles

- Apply the principle of least privilege.
- Deny access by default when authorization is uncertain.
- Never trust data received from the frontend.
- Enforce security checks on the backend, not only in the UI.
- Protect customer information, employee information, order data, and other sensitive business data.
- Do not expose internal implementation details or sensitive information.

### 11.2. Authentication

Use Flask-JWT-Extended for JWT authentication.

Requirements:

- Verify JWTs on every protected endpoint.
- Configure token expiration appropriately.
- Keep JWT signing keys in environment variables.
- Never hardcode JWT secrets in source code.
- Never expose access tokens, refresh tokens, or signing keys in logs or API responses.
- Validate token claims and reject invalid or expired tokens.
- Design refresh-token handling and revocation according to the approved authentication requirements.
- Do not invent additional authentication flows without approval.

### 11.3. Authorization and Access Control

- Enforce role-based access control on the backend.
- Verify permissions for every protected operation.
- Check whether the authenticated user is allowed to access the specific requested resource.
- Prevent users from accessing or modifying another user's data by changing an ID in the request.
- Do not rely on hidden buttons, frontend routes, or frontend role checks as security controls.
- Prevent users from modifying protected fields such as roles, account status, or ownership information unless explicitly authorized.
- Follow the approved role and permission definitions.

### 11.4. Password and Sensitive Data Protection

- Never store passwords in plaintext.
- Use a trusted password-hashing implementation with an appropriate password-hashing algorithm.
- Verify passwords using the corresponding password verification function.
- Never log passwords or authentication credentials.
- Do not return password hashes in API responses.
- Keep secrets and sensitive configuration in environment variables.
- Ensure `.env` is excluded from version control.
- Do not expose database connection strings or internal credentials.

### 11.5. Input Validation and Injection Prevention

- Validate request data using Marshmallow where appropriate.
- Validate data types, lengths, formats, required fields, and allowed values.
- Normalize input only when it is appropriate for the business requirement.
- Use SQLAlchemy parameterized queries instead of constructing SQL from untrusted input.
- Never execute raw SQL by concatenating user-provided values.
- Prevent mass-assignment vulnerabilities by explicitly defining fields that users are allowed to modify.
- Do not assume frontend validation is sufficient.
- Handle unexpected or malformed input safely.
- Escape or sanitize untrusted content appropriately before rendering it in an HTML context.

### 11.6. API Security

- Return only the data required by the requesting user.
- Prevent unauthorized access to individual records and related resources.
- Apply pagination and reasonable limits to collection endpoints.
- Avoid exposing internal database fields unnecessarily.
- Use appropriate HTTP methods and status codes.
- Configure CORS with an explicit list of permitted origins.
- Do not use unrestricted CORS in production.
- Consider rate limiting for sensitive endpoints such as login, registration, and password recovery when justified by the requirements.
- Do not introduce additional security dependencies without approval.

### 11.7. Database Security

- Use SQLAlchemy parameterized database operations.
- Never expose database credentials.
- Apply the minimum necessary database permissions.
- Avoid returning raw database exceptions to clients.
- Use transactions for operations that must succeed or fail together.
- Do not bypass the approved database schema to implement security features.
- Do not create additional tables or columns without approval.

### 11.8. HTTP and Browser Security

- Configure appropriate security headers for the deployment environment.
- Consider Content-Security-Policy, X-Content-Type-Options, and frame protection.
- Ensure HTTPS is used in production.
- If authentication tokens are stored in cookies, evaluate Secure, HttpOnly, SameSite, and CSRF protections together.
- Do not assume CORS alone protects an API against CSRF.
- Avoid rendering untrusted content as HTML in the frontend.
- Configure production error handling so debugging information is not exposed to clients.

### 11.9. Error Handling and Logging

- Return safe and understandable error messages.
- Never expose stack traces, SQL statements, secrets, tokens, or internal paths in production responses.
- Log relevant security events without recording passwords, tokens, or unnecessary personal data.
- Record authentication failures and authorization failures when appropriate.
- Avoid logging excessive sensitive information.
- Keep detailed debugging information on the server side only.

### 11.10. File Upload Security

If file-upload functionality is approved:

- Validate file type, extension, size, and content.
- Do not trust the filename or MIME type supplied by the client.
- Generate safe server-side filenames.
- Prevent path traversal and unauthorized file access.
- Store uploaded files outside executable application directories where appropriate.
- Restrict access to private files.
- Do not allow uploaded files to be executed as application code.

### 11.11. Dependency and Deployment Security

- Review dependencies before introducing them.
- Prefer maintained packages from trusted sources.
- Check for known vulnerabilities in Python dependencies using suitable tools.
- Keep dependencies updated when compatible with the project.
- Never commit secrets, credentials, or production environment files.
- Disable Flask debug mode in production.
- Do not expose development tools or debugging endpoints publicly.
- Review production configuration before deployment.

### 11.12. Security Review Workflow

When implementing or modifying security-sensitive functionality:

1. Identify the assets and data that need protection.
2. Identify the relevant user roles and permissions.
3. Consider possible misuse and unauthorized access scenarios.
4. Review authentication and authorization requirements.
5. Validate all untrusted input.
6. Check database access and sensitive data exposure.
7. Test both authorized and unauthorized requests.
8. Report unresolved security risks instead of silently ignoring them.

Do not claim that an application is completely secure based on a limited review.

Security changes must follow the approved project requirements and must not introduce unnecessary architecture, database changes, or dependencies.

## 12. Code Quality

- Follow PEP 8 conventions.
- Use descriptive variable and function names.
- Keep functions focused.
- Avoid duplicated code.
- Avoid unnecessary global variables.
- Use clear imports.
- Add comments only when they clarify non-obvious logic.
- Do not introduce unnecessary dependencies.
- Preserve existing coding conventions when they are reasonable.

## 13. Testing and Verification

Before declaring backend work complete:

- Check Python syntax.
- Check imports.
- Verify application startup when applicable.
- Test affected API endpoints.
- Test expected successful cases.
- Test invalid input and error cases.
- Test authorization where applicable.
- Verify database changes when relevant.
- Test access to resources owned by different users when applicable.
- Check that sensitive information is not exposed in API responses or logs.

Never claim that tests passed if they were not executed.

## 14. Modification Workflow

When modifying existing backend code:

1. Inspect the relevant files.
2. Understand existing behavior.
3. Identify the smallest necessary change.
4. Implement without disturbing unrelated functionality.
5. Check imports and dependencies.
6. Run relevant tests.
7. Report changed files and verification results.

Do not rewrite entire modules when a small change is sufficient.

## 15. Final Principles

- Correct business behavior comes before implementation convenience.
- Database integrity comes before shortcuts.
- Security comes before convenience.
- Maintainability comes before unnecessary abstraction.
- Small, verified changes are preferred over large, risky rewrites.
- Never invent requirements to fill gaps in the specification.
- Never introduce unapproved database changes, dependencies, or architectural complexity.
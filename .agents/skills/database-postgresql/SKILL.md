---
name: database-postgresql
description: Design, query, maintain, and migrate the Lan Yen Pharmacy PostgreSQL database using SQLAlchemy, Flask-SQLAlchemy, and Flask-Migrate. Use when working with database models, relationships, queries, migrations, indexes, transactions, or data integrity.
---

# Database PostgreSQL Skill — Lan Yen Pharmacy

## 1. Role

Act as a senior PostgreSQL database developer.

Your responsibilities:

- Maintain the approved database structure.
- Write correct and efficient database queries.
- Maintain consistency between PostgreSQL and SQLAlchemy models.
- Manage database migrations safely.
- Protect existing data and data integrity.
- Maintain reliable relationships between database entities.
- Avoid unnecessary schema complexity.

The objective is to maintain a reliable database that follows the approved requirements of Lan Yến Pharmacy.

Do not expand the database merely because a different structure appears more convenient.

## 2. Required Context

Before working with the database, read:

1. `AGENTS.md`
2. `.agents/skills/pharmacy-project/SKILL.md`
3. The approved database specification.
4. Existing SQLAlchemy models in `backend/app/models/`.
5. Existing migration files in `backend/migrations/`.
6. Relevant services, repositories, and database operations when necessary.

Never assume the database structure from memory when the actual model or specification can be inspected.

### Source of Truth

Use the following priority:

1. Explicitly approved database specification.
2. Approved database design decisions recorded by the project owner.
3. Existing PostgreSQL schema and migration history.
4. SQLAlchemy models.
5. Existing application code.

If these sources conflict:

- Identify the inconsistency.
- Explain which tables, columns, or relationships are affected.
- Do not silently choose one definition.
- Ask for clarification before making structural changes.

Existing models or migrations do not automatically authorize changes to the approved database design.

## 3. Technology

Approved technologies:

- PostgreSQL
- Flask-SQLAlchemy
- SQLAlchemy
- Flask-Migrate
- Alembic

Do not introduce another database system or ORM without approval.

Use the versions and configuration already established by the project.

Do not add database extensions, external services, or additional dependencies without a clear technical requirement and approval.

## 4. Approved Database Structure

The project currently has 15 approved tables:

1. `NguoiDung`
2. `DiaChi`
3. `DiemThuong`
4. `TinNhan`
5. `NoiDungTinNhan`
6. `LoaiThuoc`
7. `Thuoc`
8. `DonVi_GiaThuoc`
9. `LoThuoc`
10. `ChuongTrinhKhuyenMai`
11. `ChiTietKhuyenMai`
12. `GioThuoc`
13. `DonHang`
14. `ChiTietDonHang`
15. `ThemBaiViet`

The approved database specification is the source of truth for:

- Table names.
- Column names.
- Data types.
- Primary keys.
- Foreign keys.
- Nullable fields.
- Unique constraints.
- Default values.
- Relationships.
- Other explicitly approved database properties.

Do not modify these definitions based on personal assumptions.

Do not assume that a field is required, optional, unique, or automatically generated unless the approved specification confirms it.

## 5. Schema Protection

The approved database structure must be preserved.

Strict rules:

- Do not create additional tables without approval.
- Do not add columns without approval.
- Do not remove existing columns without approval.
- Do not change data types without approval.
- Do not change nullable fields without approval.
- Do not add unapproved `CHECK` constraints.
- Do not add inventory history tables.
- Do not introduce unnecessary database structures.
- Do not rename tables or columns without approval.
- Do not add foreign keys, unique constraints, or indexes without approval.
- Do not change existing default values without approval.

Business logic should be implemented in the appropriate backend layer when the approved design does not require a database-level change.

### When a Schema Change Appears Necessary

Follow this process:

1. Explain the business or technical requirement.
2. Identify the affected tables and columns.
3. Explain why the existing schema cannot satisfy the requirement.
4. Describe the proposed change.
5. Explain its impact on existing data, models, migrations, and application code.
6. Wait for explicit approval before implementation.

Never interpret a feature request as automatic permission to expand the database.

## 6. SQLAlchemy Models

When creating or modifying models:

- Match the approved PostgreSQL schema.
- Use the correct SQLAlchemy data types.
- Preserve primary keys and foreign keys.
- Preserve nullable and unique settings.
- Preserve approved default values.
- Use explicit table names where appropriate.
- Define relationships only when they reflect actual foreign-key relationships.
- Avoid unnecessary relationships and cascading behavior.
- Avoid creating duplicate models for existing tables.
- Keep model definitions consistent with the existing project conventions.

### Model Development Rules

Before modifying a model:

1. Inspect the existing model.
2. Inspect the corresponding approved table definition.
3. Inspect related models.
4. Identify affected services and repositories.
5. Confirm that the change does not introduce an unapproved schema modification.

Do not add columns, constraints, or relationships merely to make application code easier to write.

### Relationship Rules

- Follow the approved foreign-key structure.
- Use correct relationship directions.
- Avoid unnecessary bidirectional relationships.
- Configure cascade behavior only when explicitly justified by the approved design.
- Do not use ORM cascade settings as a substitute for understanding database deletion behavior.

## 7. Database Queries

Write queries that are:

- Correct.
- Readable.
- Maintainable.
- Efficient for the expected workload.

Requirements:

- Use SQLAlchemy query APIs or SQLAlchemy statements.
- Avoid raw SQL unless it is justified.
- Never concatenate untrusted input into SQL statements.
- Use parameterized queries when raw SQL is necessary.
- Avoid unnecessary repeated database queries.
- Avoid loading entire tables when only a subset is needed.
- Use pagination for large result sets when appropriate.
- Select only the required fields when practical.
- Handle empty results correctly.
- Avoid unnecessary joins.
- Consider N+1 query problems.

Do not optimize prematurely or introduce complicated query patterns without a demonstrated need.

### Query Safety

- Never build SQL statements using untrusted string concatenation.
- Validate input at the appropriate application layer.
- Do not assume that frontend validation makes database queries safe.
- Use transactions for operations that must succeed or fail together.
- Handle database exceptions appropriately.

## 8. Relationships and Data Integrity

- Respect existing foreign keys.
- Verify referenced records before operations when necessary.
- Handle missing related records.
- Avoid creating orphaned records.
- Preserve consistency between related tables.
- Use transactions for operations that must succeed or fail together.
- Handle constraint violations without exposing internal database details to users.

### Transaction Rules

For operations involving multiple dependent database changes:

1. Begin a transaction using the project's established SQLAlchemy pattern.
2. Perform the required operations.
3. Commit only after all required operations succeed.
4. Roll back when an operation fails.
5. Propagate or handle the error appropriately.

Do not commit partially completed business operations.

Avoid unnecessary nested transactions or manual transaction management when the existing project pattern already handles them.

## 9. Flask-Migrate Workflow

Use Flask-Migrate and Alembic to manage database schema changes.

### Before Creating a Migration

1. Inspect current SQLAlchemy models.
2. Inspect existing migration history.
3. Check the current database revision.
4. Verify the target database.
5. Identify the intended schema change.
6. Confirm that the change has been approved.
7. Check whether existing data could be affected.

### Typical Commands

Create a migration:

```powershell
flask --app run.py db migrate -m "describe_change"
```

Inspect the generated migration before applying it.

Apply an approved migration:

```powershell
flask --app run.py db upgrade
```

Check migration status:

```powershell
flask --app run.py db current
flask --app run.py db history
flask --app run.py db check
```

### Migration Safety

Never assume that an automatically generated migration is correct.

Inspect:

- Table creation or deletion.
- Column creation or deletion.
- Data type changes.
- Nullable changes.
- Default value changes.
- Foreign-key changes.
- Index creation or deletion.
- Constraint creation or deletion.
- Operations that could destroy or transform existing data.

If Alembic generates an unexpected operation:

- Stop.
- Identify why it was generated.
- Compare it with the approved specification.
- Correct the migration or model only after understanding the inconsistency.

Never apply an unexpected migration.

Never delete or rewrite migration history merely to resolve an error.

Never use `db downgrade`, database reset, or manual schema changes as a shortcut without understanding the impact and obtaining authorization when data or schema could be affected.

## 10. PostgreSQL Data Operations

When working with data:

- Verify the target database before executing commands.
- Distinguish development data from production data.
- Avoid destructive operations without explicit approval.
- Use transactions for multi-step changes.
- Verify affected records after important operations.
- Never expose database credentials.
- Avoid unnecessary direct modifications to production data.
- Keep sensitive information out of logs and reports.

Do not run commands that:

- Drop tables.
- Truncate data.
- Reset the database.
- Delete large sets of records.
- Overwrite existing data.

Unless explicitly authorized.

Before performing a potentially destructive operation, explain:

1. What data will be affected.
2. Which database will be affected.
3. Whether the operation can be reversed.
4. Whether a backup or recovery procedure is available.

## 11. Performance

Consider appropriate use of:

- Indexes.
- Pagination.
- Query filtering.
- Query plans.
- Efficient joins.
- Avoidance of N+1 queries.
- Selecting only required columns.

Do not add indexes automatically.

Before proposing an index, identify:

- The query it is intended to improve.
- The columns involved.
- The expected performance benefit.
- The additional storage overhead.
- The possible impact on write operations.

Request approval for schema-level changes.

Do not introduce caching or additional database infrastructure unless the requirement justifies it and the project owner approves it.

## 12. Testing and Verification

After database-related changes, perform appropriate checks.

### Model Checks

- Verify model imports.
- Verify table names.
- Verify column definitions.
- Verify primary keys and foreign keys.
- Verify nullable and unique settings.
- Verify model relationships.

### Migration Checks

- Inspect generated migration scripts.
- Verify migration dependencies.
- Check the current database revision.
- Run relevant migration checks.
- Verify that the migration matches the approved change.
- Confirm that no unintended schema operations were generated.

### Database Operation Checks

- Test database queries.
- Test create, read, update, and delete operations where relevant.
- Verify foreign-key relationships.
- Test transaction commit and rollback behavior.
- Test missing-record handling.
- Test relevant constraint violations.

### Schema Consistency

Verify consistency between:

- Approved database specification.
- SQLAlchemy models.
- PostgreSQL schema.
- Alembic migration history.

Do not claim that the database is correct merely because the application starts successfully.

Do not claim that migrations have been applied unless the command was actually executed and its result verified.

## 13. Environment and Configuration

Use the existing database configuration.

Requirements:

- Read database connection settings from environment variables.
- Keep credentials in `.env` or the approved secret-management mechanism.
- Do not hardcode database credentials.
- Do not commit `.env` files containing secrets.
- Do not print connection strings containing passwords.
- Verify the active database environment before executing database operations.

Development, testing, and production environments must not be confused.

Never execute a destructive operation against an unknown or unverified database.

## 14. Completion Report

After completing database work, report:

1. Files created or modified.
2. Tables or models affected.
3. Whether the database schema changed.
4. Migration files created or modified.
5. Migration commands executed.
6. Verification performed.
7. Whether existing data was affected.
8. Any remaining issues.

Keep reports concise for small changes.

Clearly distinguish between proposed changes, implemented changes, and verified results.

## 15. Final Principles

- The approved database specification takes priority over assumptions.
- Preserve existing data.
- Preserve the approved 15-table structure.
- Avoid unnecessary schema expansion.
- Prefer simple and understandable queries.
- Keep SQLAlchemy models synchronized with PostgreSQL.
- Manage migrations carefully.
- Use transactions for dependent operations.
- Request approval before structural changes.
- Never sacrifice data integrity for implementation convenience.

The database must remain consistent, maintainable, and faithful to the approved Lan Yến Pharmacy design.
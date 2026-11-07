---
name: pharmacy-project
description: Understand and apply the approved business requirements, user roles, workflows, database schema, architecture, and project boundaries of Lan Yen Pharmacy. Use when analyzing, planning, implementing, reviewing, or modifying any feature of the pharmacy management system. Do not invent business rules or change approved requirements without authorization.
---

# Pharmacy Project Skill — Lan Yến Pharmacy

## 1. Role and Responsibility

Act as the software analyst and project specialist for Lan Yến Pharmacy.

Understand the system from both business and technical perspectives.

This is the central project-context Skill. Its responsibility is to ensure that all development work follows the approved business requirements, technical architecture, database design, and project boundaries.

Responsibilities:

- Understand the pharmacy business and its workflows.
- Preserve approved requirements and design decisions.
- Coordinate the use of relevant specialized Skills.
- Identify dependencies between frontend, backend, and database.
- Prevent unauthorized scope expansion.
- Ensure implementation decisions are supported by project evidence.

Do not implement features based only on assumptions.

Do not invent business rules.

Do not independently modify approved requirements.

## 2. Project Overview

**Project:** Lan Yến Pharmacy

**System type:** Online pharmacy and pharmacy management system.

**Main purposes:**

- Manage pharmacy-related information.
- Manage medicine catalogs and medicine categories.
- Manage medicine batches and inventory quantities.
- Support customer shopping and order management.
- Support employee and manager operations.
- Provide communication and promotional content features.

### 2.1. Approved Technology Stack

**Backend**
- Python.
- Flask.
- Flask REST API.
- SQLAlchemy.
- Flask-Migrate.

**Database**
- PostgreSQL.

**Frontend**
- HTML.
- CSS.
- Vanilla JavaScript.

Do not introduce a different programming language, framework, database, or major dependency without explicit user approval.

### 2.2. Project Architecture

Follow the existing project directory structure and architectural conventions.

Backend responsibilities are separated into appropriate layers:

- Routes.
- Controllers.
- Services.
- Repositories.
- Models.
- Schemas.
- Utilities.

Frontend responsibilities are separated into:

- Pages.
- Layouts.
- Components.
- API communication.
- Configuration.
- Utilities.
- CSS base styles, components, layouts, and page-specific styles.

Do not reorganize the project architecture merely for personal preference.

Inspect existing files before creating new modules or changing existing structures.

## 3. User Roles and Permissions

The system currently distinguishes three user groups.

### 3.1. Customer

Customers use the system to access shopping and customer-related functions.

Customer privileges must follow approved business requirements.

Do not invent additional customer permissions.

### 3.2. Employee

Employees support pharmacy operations.

Employee responsibilities and permissions must follow approved business rules.

Do not assume every employee can access every management function.

### 3.3. Manager

Managers perform authorized management operations.

Do not automatically grant manager privileges to other roles.

### 3.4. Permission Rules

- Follow the approved role definitions.
- Validate permissions on the backend.
- Do not rely only on frontend visibility to protect restricted features.
- Verify resource ownership where applicable.
- Do not invent role hierarchies or permission levels.
- Do not expose restricted information through unauthorized API responses.

If permission requirements are unclear, request clarification.

## 4. Approved Database Baseline

The existing PostgreSQL schema contains 15 approved tables:

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

These tables form the approved database baseline.

**Database boundaries:**

- Do not add or remove tables without explicit approval.
- Do not restructure existing tables without approval.
- Do not change approved column definitions based on personal preference.
- Do not add unnecessary constraints.
- Do not create inventory history tables.
- Do not introduce additional database entities to solve problems that can be handled within the approved architecture.

The database specification and existing migrations must be inspected before making database-related changes.

## 5. Main Database Entities

The following is the project-level reference for the approved database structure. It does not replace the complete database specification or SQLAlchemy model definitions.

### 5.1. NguoiDung

Stores user information.

Important fields:

- `MaNguoiDung`
- `HoTen`
- `SDT`
- `VaiTro`
- `TrangThai`
- `Email`
- `AnhDaiDien`

Rules:

- `SDT` is unique.
- `Email` is nullable.
- `AnhDaiDien` is nullable.

### 5.2. DiaChi

Stores user addresses.

Important fields:

- `MaDiaChi`
- `TinhThanh`
- `PhuongXa`
- `DiaChiCuThe`
- `MaNguoiDung`
- `DiaChiGiao`

### 5.3. DiemThuong

Stores customer reward-point transactions.

Important fields:

- `MaDiemThuong`
- `SoDiem`
- `ThoiGianTichDiem`
- `MaNguoiDung`
- `LoaiGiaoDich`
- `LyDo`

### 5.4. TinNhan

Stores conversation information.

Important fields:

- `MaTinNhan`
- `NguoiGui`
- `MaNhanVien`
- `TrangThai`

`MaNhanVien` is nullable.

### 5.5. NoiDungTinNhan

Stores individual messages.

Important fields:

- `MaNoiDung`
- `MaTinNhan`
- `NguoiGui`
- `NoiDung`
- `ThoiGianGui`

### 5.6. LoaiThuoc

Stores medicine categories.

Important fields:

- `MaLoaiThuoc`
- `TenLoaiThuoc`

### 5.7. Thuoc

Stores medicine information.

Important fields:

- `MaThuoc`
- `MaLoaiThuoc`
- `HinhAnh`
- `TenThuoc`
- `MoTa`
- `MaDuoc`
- `SoDangKy`
- `DangBaoChe`
- `QuyCachDongGoi`
- `NhaSanXuat`
- `NuocSanXuat`
- `CachDung`
- `ChongChiDinh`
- `BaoQuan`
- `NguongTonKho`
- `PhanLoai`

### 5.8. DonVi_GiaThuoc

Stores medicine sales units and prices.

Important fields:

- `MaDonGia`
- `MaThuoc`
- `DonViTinh`
- `GiaBan`
- `SoLuongQuyDoi`

### 5.9. LoThuoc

Stores medicine batch information.

Important fields:

- `MaLo`
- `SoLoSanXuat`
- `NgaySanXuat`
- `HanSuDung`
- `SoLuongNhap`
- `GiaNhap`
- `MaThuoc`
- `SoLuongTon`

Rules:

- Different batches of the same medicine may have different expiration dates.
- Different batches may have different purchase prices.
- Do not treat all batches of one medicine as identical.

### 5.10. ChuongTrinhKhuyenMai

Stores promotion programs.

Important fields:

- `MaChuongTrinh`
- `TenChuongTrinh`
- `NgayBatDau`
- `NgayKetThuc`

### 5.11. ChiTietKhuyenMai

Connects promotions with medicines.

Composite primary key:

- `MaChuongTrinh`
- `MaThuoc`

Other fields:

- `LoaiGiamGia`
- `GiaTriGiam`
- `SoLuong`

Do not change its composite primary key without approval.

### 5.12. GioThuoc

Stores customer shopping-cart items.

Important fields:

- `MaGio`
- `MaNguoiDung`
- `MaThuoc`
- `SoLuong`
- `MaDonGia`

### 5.13. DonHang

Stores order information.

Important fields:

- `MaDonHang`
- `MaNguoiMua`
- `MaNhanVien`
- `TongTien`
- `TienGiamGia`
- `TongThanhToan`
- `TrangThaiDonHang`
- `PhuongThucThanhToan`
- `NgayDat`
- `GhiChu`
- `TrangThaiThanhToan`
- `KenhDatHang`

Rules:

- `MaNhanVien` is nullable.
- `GhiChu` is nullable.

### 5.14. ChiTietDonHang

Stores order details.

Important fields:

- `MaChiTiet`
- `MaDonHang`
- `MaThuoc`
- `SoLuong`
- `DonGia`
- `MaDonGia`

### 5.15. ThemBaiViet

Stores published content.

Important fields:

- `MaBaiViet`
- `NoiDung`
- `TieuDe`
- `ThoiGianDang`
- `NguoiDang`

## 6. Database Rules

- PostgreSQL is the approved database.
- SQLAlchemy models must match the approved schema.
- Use Flask-Migrate for approved schema changes.
- Preserve existing primary keys and foreign keys.
- Respect nullable fields.
- Respect existing unique constraints.
- Do not add unapproved database tables.
- Do not create inventory history tables.
- Do not add unnecessary CHECK constraints.
- Do not change field types based on personal preference.
- Do not silently modify defaults, indexes, relationships, or column names.

When a feature appears to require a schema change:

1. Identify the affected entity and field.
2. Explain why the existing schema cannot support the requirement.
3. Describe the proposed change.
4. Identify its impact on existing data and application code.
5. Obtain explicit approval before changing the schema.

## 7. Business Logic Boundaries

The database structure does not automatically define every business rule.

Before implementing business logic, inspect the approved requirements and existing implementation.

Do not independently invent:

- Medicine pricing policies.
- Discount calculation policies.
- Reward-point conversion policies.
- Order cancellation rules.
- Inventory adjustment policies.
- Employee assignment rules.
- Customer permission rules.
- Promotion eligibility conditions.
- Payment processing rules.
- Medicine availability policies.

If a business rule is missing:

1. Identify the missing decision.
2. Explain why it affects implementation.
3. Ask the user for clarification.
4. Do not silently choose a rule.
5. Do not expand the project scope.

## 8. Medicine and Inventory Context

Medicine information and medicine inventory are related but distinct.

The system has:

- Medicine catalog information in `Thuoc`.
- Sales units and prices in `DonVi_GiaThuoc`.
- Batch information and stock quantities in `LoThuoc`.

Do not incorrectly treat the medicine catalog quantity as the complete inventory model.

Do not assume:

- All batches have the same expiration date.
- All batches have the same purchase price.
- A medicine's sales unit is equivalent to its inventory unit.
- A stock-management policy that has not been approved.

Do not introduce new inventory management tables without approval.

## 9. Frontend and Backend Coordination

The frontend and backend must follow consistent API contracts.

Before implementing an integration:

1. Inspect existing Flask routes.
2. Inspect controllers and services.
3. Inspect SQLAlchemy models.
4. Inspect relevant schemas and validation rules.
5. Identify request and response structures.
6. Confirm authentication and authorization requirements.
7. Implement the frontend using the actual API contract.
8. Verify success and error responses.

Rules:

- Do not invent API endpoints.
- Do not assume frontend validation is sufficient.
- Do not change API contracts without approval.
- Do not expose sensitive backend information to the frontend.
- Do not duplicate business rules inconsistently across frontend and backend.

## 10. Frontend Design and User Experience Context

The frontend must follow the approved project Design System.

Reference:

`docs/DESIGN_SYSTEM.md`

Approved design direction:

- Green as the primary brand color.
- White as the main supporting color.
- Modern healthcare visual language.
- Clean, trustworthy, clear, and professional presentation.

Rules:

- Follow approved color tokens.
- Maintain consistent typography and spacing.
- Design page layouts according to their actual business purpose.
- Do not use generic dashboard templates as the default solution.
- Do not repeat identical page compositions unnecessarily.
- Do not introduce frontend frameworks or CSS frameworks without approval.
- Preserve accessibility and responsive behavior.

The frontend must not invent product information, prices, medical claims, or pharmacy policies.

## 11. Skill Coordination

This Skill provides project context. Specialized Skills provide implementation and review expertise.

Use the relevant Skills according to the task.

| Skill | Primary responsibility |
|---|---|
| `pharmacy-project` | Project context, requirements, and boundaries |
| `frontend-design` | Visual direction and interface design |
| `frontend-development` | HTML, CSS, and JavaScript implementation |
| `accessibility` | Accessibility standards and verification |
| `web-design-guidelines` | UI quality and interface audits |
| `flask-backend` | Flask API and backend implementation |
| `database-postgresql` | PostgreSQL, SQLAlchemy, and migrations |
| `code-review-testing` | Code review, testing, and regression verification |

### 11.1. Skill Selection

For frontend design work:

- Use `frontend-design`.
- Consult `accessibility` when accessibility requirements are relevant.

For frontend implementation:

- Use `frontend-development`.
- Consult `frontend-design` for approved visual direction.
- Consult `accessibility` for accessibility requirements.

For backend implementation:

- Use `flask-backend`.
- Consult `database-postgresql` when database entities, queries, or migrations are involved.

For database changes:

- Use `database-postgresql`.
- Follow this Skill's approved database boundaries.

For UI audits:

- Use `web-design-guidelines`.
- Use `accessibility` for detailed accessibility verification.

For code review and testing:

- Use `code-review-testing`.
- Consult the relevant technical Skill for the affected code.

Do not load every Skill for every task. Select only the Skills relevant to the requested work.

### 11.2. Conflict Resolution

If instructions appear to conflict, apply this priority:

1. The user's latest explicit and approved instruction.
2. Approved business requirements and database specifications.
3. Root `AGENTS.md` and other applicable project-level instructions.
4. `docs/DESIGN_SYSTEM.md` for visual design decisions.
5. This project-context Skill.
6. Relevant specialized Skills.
7. External recommendations and general best practices.

A specialized Skill must not independently override approved project requirements.

If two approved requirements genuinely conflict, explain the conflict and request clarification instead of silently choosing one.

## 12. Handling Unclear Requirements

When requirements are incomplete:

1. Identify exactly what is missing.
2. Explain why the information matters.
3. Ask one focused clarification question.
4. Wait for approval when the decision affects business rules, database structure, API contracts, or project scope.
5. Do not silently choose an implementation that changes approved behavior.

When the missing detail does not materially affect the approved requirement, use the smallest reasonable implementation and document the assumption.

## 13. Implementation Workflow

For every significant feature, follow this workflow.

### Phase 1 — Requirement Analysis

- Understand the requested business function.
- Identify the intended users and roles.
- Determine the expected behavior.
- Identify missing requirements.

### Phase 2 — Impact Analysis

Identify affected:

- Database entities.
- Backend modules.
- API endpoints.
- Frontend pages.
- User roles and permissions.
- Existing workflows.

### Phase 3 — Skill Selection

Select the specialized Skills required for the task.

Do not use unrelated Skills unnecessarily.

### Phase 4 — Implementation Planning

- Choose the smallest implementation that satisfies the requirement.
- Follow existing architecture.
- Preserve approved interfaces and contracts.
- Identify any changes requiring authorization.

### Phase 5 — Development

Implement only the requested scope.

Avoid unrelated refactoring, unnecessary dependencies, and unauthorized schema changes.

### Phase 6 — Verification

Verify:

- Expected behavior.
- Role-based permissions.
- API integration.
- Database consistency when relevant.
- Accessibility and responsive behavior when relevant.
- Regression risks.

### Phase 7 — Reporting

Explain:

- What was changed.
- Which files were affected.
- Which requirements were satisfied.
- Which checks were performed.
- Any remaining limitations or decisions requiring approval.

Do not claim that tests passed if they were not actually performed.

## 14. Change Management and Scope Control

Before modifying existing functionality:

- Inspect the current implementation.
- Understand existing dependencies.
- Preserve working behavior unless the user requests a change.
- Avoid changing unrelated files.
- Avoid unnecessary architectural refactoring.
- Avoid adding dependencies without a clear need and approval.
- Do not replace existing implementations without understanding their purpose.

If a requested change affects multiple modules, explain the impact before making substantial changes.

Never silently expand the project scope.

## 15. Final Principles

- Understand the pharmacy business before coding.
- Respect the approved requirements.
- Respect the approved database.
- Do not invent business rules.
- Do not introduce unapproved technologies.
- Coordinate specialized Skills appropriately.
- Maintain consistency between frontend and backend.
- Preserve existing project architecture.
- Avoid unnecessary complexity.
- Verify actual behavior.
- Support technical decisions with evidence.

The purpose of this Skill is to ensure that every part of Lan Yến Pharmacy develops consistently according to the user's approved requirements and the real needs of the pharmacy.
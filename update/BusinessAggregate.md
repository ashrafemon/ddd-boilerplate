# ERP Purchasing Module — DDD Update Specification

**Scope:** Purchase Order (PO), Goods Receipt Note (GRN), Inventory Integration, Policies, Invariants, Domain Events, and Accounting Integration

**Purpose:** Improve an existing ERP purchasing implementation incrementally, using established ERP workflows and Domain-Driven Design (DDD) principles.

**Reference systems:** Odoo, QuickBooks, Zoho Inventory

**Implementation strategy:** Audit existing behavior first, preserve working functionality, then implement missing rules and integrations.

---

## 1. Objectives

Update the existing purchasing module to ensure:

- Purchase Orders and Goods Receipt Notes have explicit domain lifecycles.
- Business rules are enforced inside domain/application boundaries rather than only in controllers.
- Partial receipts and multiple receipts per PO are supported.
- Receipt posting updates inventory reliably.
- Duplicate commands and concurrent receiving cannot corrupt stock or quantities.
- Posted documents cannot be silently edited or deleted.
- Approval, cancellation, closure, and reversal follow explicit policies.
- Inventory, purchasing, and accounts payable remain separate responsibilities.
- Domain events and side effects are delivered reliably.
- Existing data and API compatibility are preserved where practical.

## 2. Implementation Principles

### 2.1 Audit before modifying

Inspect the existing implementation before introducing new classes, tables, status values, or events.

Identify:

- Existing PO and GRN entities and relationships.
- Current status enums and state transitions.
- Quantity and monetary calculation logic.
- Existing receipt and stock movement tables.
- Existing approval and authorization mechanisms.
- Existing database transactions and concurrency controls.
- Existing domain events, message queues, and audit logs.
- Existing APIs and external integrations.
- Existing tests and production data dependencies.

Do not introduce duplicate entities or ledgers when equivalent functionality already exists.

### 2.2 Preserve backward compatibility

- Avoid renaming existing database columns without a migration plan.
- Avoid removing existing API fields without a compatibility strategy.
- Preserve historical document numbers and posted transactions.
- Introduce new fields as nullable or defaulted when appropriate.
- Backfill derived values before making new fields mandatory.
- Use staged migrations for large tables.
- Never silently reinterpret historical transactions.

### 2.3 Separate responsibilities

- Purchasing owns purchase commitments and commercial terms.
- Receiving owns receipt documents and receiving decisions.
- Inventory owns stock movements and stock balances.
- Accounts Payable owns supplier bills and payment obligations.
- Accounting owns posted financial entries.
- Application services coordinate workflows across these boundaries.

---

## 3. Purchase Order Updates

### 3.1 Review existing header fields

Confirm that the PO header contains, or has an equivalent representation for:

- `id`
- `tenant_id`
- `company_id`
- `po_number`
- `supplier_id`
- `order_date`
- `expected_delivery_date`
- `currency_code`
- `exchange_rate`, when applicable
- `warehouse_id`
- `payment_terms_id`
- `buyer_id`
- `supplier_reference`
- `subtotal`
- `discount_total`
- `tax_total`
- `grand_total`
- `status`
- `approval_status`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `version`

Optional fields include delivery address, department, project, shipping charges, terms and conditions, source requisition, and custom fields.

Use the existing field names if they already serve these purposes.

### 3.2 Review PO line fields

Each PO line should have a stable identifier and an explicit relationship to its parent PO.

Recommended fields:

- `id`
- `purchase_order_id`
- `line_number`
- `item_id`
- `description_snapshot`
- `item_type`
- `quantity_ordered`
- `uom_id`
- `base_quantity_ordered`
- `unit_price`
- `discount_percent`
- `tax_code_id`
- `line_subtotal`
- `line_tax_amount`
- `line_total`
- `expected_delivery_date`
- `warehouse_id`
- `status`

Add account, project, or cost-center references where required.

### 3.3 Protect commercial snapshots

Once a PO is approved or issued, preserve its historical commercial terms.

A change to the product master must not silently change an existing PO's agreed description, price, UOM conversion, or tax treatment.

For issued POs, implement controlled amendments rather than unrestricted editing.

Record:

- Who amended the PO.
- When it was amended.
- Which fields or lines changed.
- Why the amendment occurred, when required.
- Whether additional approval was required.

### 3.4 Calculate totals on the server

Do not trust totals submitted by the frontend.

The domain or application layer must calculate:

- Line subtotal.
- Line discount.
- Taxable amount.
- Line tax.
- Document subtotal.
- Document discounts.
- Document tax.
- Shipping and other charges.
- Final document total.

Use decimal arithmetic and configured currency rounding.

Define the calculation order explicitly to avoid discrepancies between the UI, PO, and supplier bill.

---

## 4. Purchase Order Lifecycle

Use explicit business transitions instead of arbitrary status updates.

Recommended lifecycle:

`DRAFT → PENDING_APPROVAL → APPROVED → ISSUED`

Possible terminal or subsequent states:

- `CLOSED`
- `CANCELLED`

Approval and issuance may be combined in a simpler implementation if business requirements permit it.

### Required commands

- `CreatePurchaseOrder`
- `UpdatePurchaseOrder`
- `AddPurchaseOrderLine`
- `UpdatePurchaseOrderLine`
- `RemovePurchaseOrderLine`
- `SubmitPurchaseOrderForApproval`
- `ApprovePurchaseOrder`
- `RejectPurchaseOrder`
- `IssuePurchaseOrder`
- `AmendPurchaseOrder`
- `CancelPurchaseOrder`
- `ClosePurchaseOrder`
- `ReopenPurchaseOrder`, if supported

### Lifecycle rules

1. A PO must contain at least one valid line before approval or issuance.
2. A PO cannot be issued when mandatory approval is incomplete.
3. A cancelled PO cannot receive additional goods.
4. An issued PO cannot be freely edited.
5. Cancellation must check receipt, billing, and outstanding commitment constraints.
6. Closure must prevent further receiving unless an authorized reopening workflow is used.
7. Approval and issuance must record actor and timestamp.
8. Rejection must record a reason when required by policy.
9. State transitions must be enforced by domain/application logic, not only by UI buttons.
10. Concurrent edits must not silently overwrite newer changes.

### Separate status dimensions

Do not overload one status field with unrelated concepts.

Maintain separate lifecycle, receipt, billing, and payment statuses where appropriate.

Receipt status can be derived from posted receipt history:

- `NOT_RECEIVED`
- `PARTIALLY_RECEIVED`
- `FULLY_RECEIVED`

Billing status should be derived from supplier bill allocations:

- `NOT_BILLED`
- `PARTIALLY_BILLED`
- `FULLY_BILLED`

Payment status belongs to Accounts Payable.

These statuses should not become independent, manually editable sources of truth.

---

## 5. Goods Receipt Note Updates

### 5.1 Review existing GRN header fields

Confirm the availability of:

- `id`
- `tenant_id`
- `company_id`
- `grn_number`
- `purchase_order_id`
- `supplier_id`
- `receipt_date`
- `received_at`
- `warehouse_id`
- `receiving_location_id`
- `supplier_delivery_note`
- `received_by`
- `inspected_by`
- `status`
- `inspection_status`
- `posted_at`
- `posted_by`
- `reversal_of_id`
- `created_at`
- `created_by`
- `version`

The PO reference may be nullable only when the business explicitly supports non-PO receipts.

### 5.2 Review GRN line fields

Recommended fields:

- `id`
- `goods_receipt_id`
- `purchase_order_line_id`
- `item_id`
- `quantity_received`
- `quantity_accepted`
- `quantity_rejected`
- `uom_id`
- `base_quantity_received`
- `destination_location_id`
- `lot_id` or `batch_number`, when applicable
- `serial_numbers`, when applicable
- `expiry_date`, when applicable
- `inspection_result`
- `rejection_reason_code`
- `notes`

Represent damaged goods either as a separate, mutually exclusive disposition or as a reason attached to a rejected quantity. Do not count the same quantity twice.

### 5.3 GRN lifecycle

Recommended transitions:

`DRAFT → PENDING_INSPECTION → POSTED`

Inspection may be skipped when it is not required.

Cancellation of a draft is permitted according to policy.

A posted GRN must be corrected through a reversal or an appropriate return workflow, not by silently editing or deleting historical movements.

### Required commands

- `CreateGoodsReceipt`
- `UpdateGoodsReceiptDraft`
- `AddGoodsReceiptLine`
- `RecordInspectionResult`
- `AcceptReceiptQuantity`
- `RejectReceiptQuantity`
- `SubmitGoodsReceipt`
- `ApproveGoodsReceipt`, if approval is required
- `PostGoodsReceipt`
- `ReverseGoodsReceipt`
- `CreateSupplierReturn`

### GRN rules

1. The source PO must be eligible for receiving.
2. The supplier and legal entity must match the source PO.
3. Each receipt line must reference a valid PO line.
4. Receipt quantities must be positive and use valid UOM conversions.
5. Required lot, serial, expiry, and inspection information must be supplied.
6. Rejected goods must have an explicit disposition.
7. Posting must be atomic and idempotent.
8. A GRN cannot be posted twice.
9. A posted GRN cannot be silently edited or deleted.
10. Every reversal must reference its original posted movement.
11. A reversal must not exceed the eligible quantity of the original movement.
12. Every inventory movement must be traceable to the GRN and its source line.

---

## 6. Domain Invariants

Invariants are mandatory business truths. Enforce them regardless of whether the operation originates from an API, UI, integration, or background worker.

### PO invariants

**PO-01: Valid identity**

PO numbers must be unique within the configured numbering scope.

**PO-02: Valid lines**

An approvable or issuable PO must contain valid lines.

**PO-03: Positive quantities**

Order quantities must be positive and respect UOM precision.

**PO-04: Valid monetary values**

Prices, discounts, taxes, and totals must follow configured rules.

**PO-05: Lifecycle integrity**

Only valid state transitions are allowed.

**PO-06: Commercial immutability**

Issued commercial terms can only be changed through authorized amendments.

**PO-07: Receiving limit**

For a PO line:

- `ordered_qty` is the ordered quantity.
- `net_received_qty` is the applicable net receipt balance.
- `tolerance` is the configured over-receipt tolerance.

The normal limit is:

`net_received_qty + proposed_qty <= ordered_qty * (1 + tolerance)`

The authoritative receiving balance must be checked atomically during reservation or posting.

Define how reversals, supplier returns, and rejected goods affect each individual balance. Do not use one ambiguous received-quantity field for every business purpose.

### GRN invariants

**GRN-01: Quantity reconciliation**

When accepted and rejected are mutually exclusive dispositions:

`received_qty = accepted_qty + rejected_qty`

Extend the equation if damaged, quarantined, or other quantities are represented as separate dispositions.

**GRN-02: No duplicate disposition**

A physical quantity must not be accepted or rejected twice.

**GRN-03: Stock integrity**

Only eligible accepted quantities become available stock.

Quarantined goods must not be treated as normally available.

**GRN-04: Posting integrity**

The GRN, inventory movement records, and durable posting record must commit together when they share a database transaction.

**GRN-05: Reversal integrity**

Reversals must produce compensating movements and preserve the original transaction history.

**GRN-06: Traceability**

Every posted movement must identify its source receipt, receipt line, item, location, and relevant lot or serial information.

### Concurrency invariant

Two receiving operations must not collectively exceed the permitted receiving quantity.

A read followed by an ordinary save is insufficient.

Use row locking, atomic conditional updates, or another concurrency-safe allocation mechanism. Include concurrency tests.

---

## 7. Policies

Implement policies as explicit business rules instead of scattering conditional statements throughout the codebase.

Recommended policies:

### ApprovalPolicy

Controls:

- Approval thresholds.
- Approver selection.
- Multi-level approval.
- Separation of duties.
- Delegation.
- Rejection reasons.
- Reapproval after material amendments.

### OverReceiptPolicy

Controls:

- Maximum permitted excess quantity.
- Percentage or absolute tolerances.
- Whether approval is required.
- Whether excess receipt is blocked.

### InspectionPolicy

Controls:

- Which item categories require inspection.
- Required inspection tests.
- Acceptance criteria.
- Quarantine requirements.
- Rejection and disposition rules.

### CancellationPolicy

Controls:

- Whether a draft can be cancelled.
- Whether an issued PO can be cancelled.
- Restrictions caused by posted receipts or supplier bills.
- Handling of outstanding commitments.

### ClosurePolicy

Controls:

- When an order can be closed.
- How remaining quantities are treated.
- Whether short delivery can be accepted as final.
- Whether reopening is allowed.

### SupplierPolicy

Controls:

- Supplier eligibility.
- Blocked supplier handling.
- Supplier-specific receiving tolerances.
- Required supplier references and documentation.

### MatchingPolicy

Controls:

- PO/GRN/bill quantity matching.
- Price variance tolerance.
- Tax variance handling.
- Required approval for discrepancies.

### AccountingPeriodPolicy

Controls:

- Permitted receipt dates.
- Backdating.
- Closed-period restrictions.
- Posting date versus physical receipt date.

Keep policy decisions auditable and versioned where changing a policy could affect historical decisions.

---

## 8. Domain Events and Side Effects

Use past-tense event names that represent facts that have already happened.

Suggested events:

- `PurchaseOrderCreated`
- `PurchaseOrderSubmittedForApproval`
- `PurchaseOrderApproved`
- `PurchaseOrderRejected`
- `PurchaseOrderIssued`
- `PurchaseOrderAmended`
- `PurchaseOrderCancelled`
- `PurchaseOrderClosed`
- `GoodsReceiptCreated`
- `GoodsReceiptSubmittedForInspection`
- `GoodsReceiptApproved`
- `GoodsReceiptPosted`
- `GoodsReceiptReversed`
- `SupplierReturnPosted`

### Side-effect rules

Issuing a PO may trigger:

- Supplier notification.
- PDF generation.
- Audit logging.
- Buyer notification.

Posting a GRN may trigger:

- Inventory movement creation.
- Receipt balance projection updates.
- Warehouse dashboard updates.
- Quality notifications.
- Purchase-order receipt status updates.
- GRNI or valuation processing, according to accounting policy.

Reversing a GRN may trigger:

- Compensating stock movements.
- Inventory projection updates.
- Receipt balance recalculation.
- Relevant accounting adjustments.
- Notifications and audit records.

### Transactional outbox

When an operation commits domain state and emits an event:

1. Validate the command.
2. Persist the state changes.
3. Persist inventory movements, when part of the same transaction.
4. Persist the outbox event.
5. Commit the transaction.
6. Publish the outbox event asynchronously.
7. Let consumers process events idempotently.

Never publish a successful-posting event before the underlying transaction commits.

If inventory is a separate service, use a durable distributed workflow instead of assuming multiple independent databases can commit atomically.

---

## 9. Inventory Integration

The inventory ledger should be the authoritative record of stock movements.

Avoid directly changing stock balances without recording the underlying movement.

A movement should capture the relevant information:

- Item.
- Quantity.
- UOM or base quantity.
- Source location.
- Destination location.
- Movement type.
- Source document and line.
- Lot or serial reference.
- Effective date.
- Actor or system identity.
- Reversal reference, where applicable.

### Receipt posting behavior

For an eligible GRN:

1. Validate the receipt and its source PO.
2. Verify receipt quantities and current receiving balances.
3. Validate inspection and tracking requirements.
4. Determine inventory disposition.
5. Record eligible stock movements.
6. Mark the receipt as posted.
7. Record the posting audit information.
8. Persist the outbox event.
9. Commit the transaction.

Only eligible accepted quantities should enter available stock.

Rejected goods may remain in a receiving or quarantine location or be returned, according to policy.

Ensure retries cannot duplicate stock movements.

---

## 10. Accounts Payable Integration

Keep supplier bills separate from GRNs.

Implement three-way matching between:

- Purchase Order: commercial commitment.
- Goods Receipt Note: physical receipt.
- Supplier Bill: supplier's invoiced amount.

Support:

- Multiple GRNs for one PO.
- Multiple bills for one PO.
- Partial receipts.
- Partial billing.
- Quantity variance checks.
- Price variance checks.
- Tax variance checks.
- Supplier returns and credit notes.
- Service POs where physical receipts are not required.

Receiving goods does not automatically mean the supplier bill is paid.

Where applicable, accounting can record inventory and a goods-received-not-invoiced clearing liability at receipt, then clear or adjust that balance when the bill is posted.

Financial entries must follow the configured accounting policy.

---

## 11. API and Application Layer

Prefer business-intention commands over arbitrary status changes.

Suggested endpoints, adapted to the existing API conventions:

- `POST /purchase-orders`
- `PATCH /purchase-orders/{id}`
- `POST /purchase-orders/{id}/submit`
- `POST /purchase-orders/{id}/approve`
- `POST /purchase-orders/{id}/issue`
- `POST /purchase-orders/{id}/cancel`
- `POST /purchase-orders/{id}/close`
- `POST /goods-receipts`
- `POST /goods-receipts/{id}/submit`
- `POST /goods-receipts/{id}/post`
- `POST /goods-receipts/{id}/reverse`
- `GET /purchase-orders/{id}/receipts`
- `GET /purchase-orders/{id}/remaining-quantities`

Use the existing route naming and API versioning conventions where possible.

### Application responsibilities

Application handlers should:

- Load the required aggregates.
- Authorize the actor.
- Execute the domain operation.
- Coordinate policies and cross-aggregate checks.
- Establish transaction boundaries.
- Persist state and outbox events.
- Return the command result.

Domain entities should not directly send emails, make HTTP calls, or issue arbitrary SQL statements.

---

## 12. Database and Migration Guidance

Before adding tables, inspect whether the current schema already provides the required capabilities.

Potential entities or tables include:

- `purchase_orders`
- `purchase_order_lines`
- `goods_receipts`
- `goods_receipt_lines`
- `inventory_movements`
- `receipt_inspections`
- `supplier_returns`
- `approval_records`
- `outbox_events`
- `audit_logs`

These are logical names, not mandatory names for the existing database.

### Recommended safeguards

- Foreign keys for document relationships.
- Unique constraints for document numbering.
- Tenant and company scoping.
- Decimal columns for money and quantities.
- Optimistic concurrency versions where appropriate.
- Indexes for PO lines, receipt lines, source document references, and inventory queries.
- Unique idempotency keys for posting commands.
- Database transactions for stock-changing operations.

Use migrations that can be safely applied to existing data.

Do not rebuild historical stock movements solely to match a new field design unless there is a verified reconciliation and migration plan.

---

## 13. Testing Requirements

### Purchase Order tests

- Draft PO can be created.
- PO without lines cannot be issued.
- Required approval cannot be bypassed.
- Unauthorized users cannot approve or issue.
- Issued PO amendments follow policy.
- Cancelled POs cannot receive new goods.
- PO totals are recalculated by the server.
- Concurrent changes do not silently overwrite each other.

### GRN tests

- GRN cannot reference an invalid PO line.
- Supplier and legal entity must match.
- Partial receipts update remaining quantities correctly.
- Over-receipts follow the configured policy.
- Inspection-required goods cannot bypass inspection.
- Rejected goods do not increase available stock.
- A posted GRN cannot be edited as a draft.
- Repeated posting does not duplicate movements.
- Reversal creates compensating movements.
- Supplier returns preserve the original receipt history.

### Integration and concurrency tests

- Two concurrent receipts cannot exceed the permitted quantity.
- Database failure rolls back the posting transaction.
- Outbox events are persisted with successful state changes.
- Retried event consumers do not duplicate side effects.
- Inventory and PO receiving projections reconcile.
- Bill matching handles partial receipts and multiple bills.
- Tenant boundaries prevent cross-company document references.

Use integration tests against the actual database engine for locking, uniqueness, and transaction behavior. In-memory substitutes often fail to reproduce production concurrency semantics.

---

## 14. Implementation Roadmap

### Phase 1: Audit

- Map existing entities, tables, APIs, statuses, and side effects.
- Document current behavior and compatibility requirements.
- Identify missing invariants and duplicated responsibilities.

**Deliverable:** Existing-to-target gap analysis.

### Phase 2: Domain rules

- Add missing lifecycle guards.
- Centralize quantity and money calculations.
- Implement policies.
- Prevent arbitrary status mutation.

**Deliverable:** Domain rules and unit tests.

### Phase 3: Receiving integrity

- Support partial receipts.
- Add concurrency-safe receiving validation.
- Make posting transactional and idempotent.
- Introduce reversal workflows.

**Deliverable:** Reliable GRN and inventory integration.

### Phase 4: Events and auditability

- Add missing domain events.
- Introduce a transactional outbox if required.
- Record actor, timestamps, and reversal links.
- Make consumers idempotent.

**Deliverable:** Reliable downstream side effects.

### Phase 5: Finance integration

- Add or improve three-way matching.
- Implement variance policies.
- Integrate GRNI and inventory valuation as applicable.
- Support supplier returns and credit notes.

**Deliverable:** Purchasing-to-accounting workflow.

### Phase 6: Production hardening

- Run concurrency and failure-recovery tests.
- Reconcile PO quantities against receipt history.
- Reconcile stock balances against the inventory ledger.
- Verify migration rollback and recovery procedures.
- Monitor failed outbox messages and inconsistent projections.

**Deliverable:** Tested, auditable purchasing workflow.

---

## 15. Definition of Done

An update is complete when:

- [ ] Existing functionality has been audited and preserved.
- [ ] PO and GRN lifecycles are explicit.
- [ ] Business invariants are enforced outside the UI.
- [ ] Partial receipts and multiple receipts per PO work correctly.
- [ ] Over-receipt policy is configurable.
- [ ] Stock movements are traceable and idempotent.
- [ ] Concurrent receiving is safe.
- [ ] Posted transactions cannot be silently changed.
- [ ] Reversals preserve historical records.
- [ ] Approval and authorization rules are tested.
- [ ] Domain events are persisted and delivered reliably.
- [ ] Supplier bill matching follows explicit policies.
- [ ] Database migrations preserve existing data.
- [ ] Integration tests cover rollback, retries, and concurrency.
- [ ] Operational reconciliation and failure monitoring are available.

---

## 16. Reference Documentation

- Odoo documentation: https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/receipts_three_steps.html
- Odoo inventory valuation: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/operations_valuation.html
- Zoho Inventory Purchase Orders API: https://www.zoho.com/inventory/api/v1/purchaseorders/
- Zoho Inventory Purchase Receives API: https://www.zoho.com/inventory/api/v1/purchasereceives/
- Zoho Inventory partial purchase receipts: https://www.zoho.com/us/inventory/kb/purchase-order/po-receives.html

---

## Final Implementation Rule

**Do not rewrite the entire purchasing module merely to match this specification.**

Compare the existing code against each requirement. Keep what is already correct, update what is incomplete, and introduce new components only where a genuine domain or reliability gap exists.

The goal is a purchasing system that remains consistent under partial receiving, concurrent users, failed transactions, retries, returns, and accounting integration—not merely a system with more fields and classes.

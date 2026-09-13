# DI Wiring — who injects whom, which token binds to which implementation

**Generated** by `scripts/generate-di-wiring.mjs` (`npm run docs:di`) from real source:
`@Module` provider bindings + every constructor, with each dependency resolved through the
consuming file's own imports — so module-local tokens (each module's own `CompanyConfigPort` /
`NumberingPort`) are attributed to the right module, and only genuinely cross-boundary edges
appear. Blocks are validated for mermaid-safe syntax at generation time.

- solid `-->|injects|` — constructor dependency
- dashed `-.->` — Nest binding declared in the module (`useClass` / `useExisting`)
- `TransactionHost / Queue / AmqpConnection …` — library providers (write TX host, BullMQ, brokers)
- `injects via OwnerModule` — the token is provided by a DIFFERENT module (cross-boundary)
- `XModule bootstrap` — what the module class injects to register opt-in handlers

---

## Cross-module graph (Nest imports + token ownership)

```mermaid
flowchart LR
    VendorModule["VendorModule"]
    DatabaseModule["DatabaseModule"]
    VendorModule -->|PrismaReadPort| DatabaseModule
    OutboxModule["OutboxModule"]
    VendorModule -->|OutboxWriterPort| OutboxModule
    ConfigurationModule["ConfigurationModule"]
    VendorModule -->|CompanyConfigPort| ConfigurationModule
    GoodReceiptNoteModule["GoodReceiptNoteModule"]
    GoodReceiptNoteModule -->|PrismaReadPort| DatabaseModule
    GoodReceiptNoteModule -->|OutboxWriterPort| OutboxModule
    GoodReceiptNoteModule -->|CompanyConfigPort| ConfigurationModule
    PurchaseOrderModule["PurchaseOrderModule"]
    GoodReceiptNoteModule -->|PurchaseOrderForGrnPort| PurchaseOrderModule
    ProductModule["ProductModule"]
    ProductModule -->|PrismaReadPort| DatabaseModule
    ProductModule -->|OutboxWriterPort| OutboxModule
    ProductModule -->|CompanyConfigPort| ConfigurationModule
    PurchaseOrderModule -->|PrismaReadPort| DatabaseModule
    PurchaseOrderModule -->|OutboxWriterPort| OutboxModule
    PurchaseOrderModule -->|CompanyConfigPort| ConfigurationModule
    PurchaseOrderModule -->|ProductForPurchasePort| ProductModule
    PurchaseOrderModule -->|VendorForPurchasePort| VendorModule
    InvoiceModule["InvoiceModule"]
    RecurringModule["RecurringModule"]
    InvoiceModule -->|RecurringExecutionPort| RecurringModule
    ObservabilityModule["ObservabilityModule"]
    InvoiceModule -->|LoggerPort| ObservabilityModule
    InvoiceModule -->|PrismaReadPort| DatabaseModule
    InvoiceModule -->|OutboxWriterPort| OutboxModule
    InvoiceModule -->|CompanyConfigPort| ConfigurationModule
    NumberingModule["NumberingModule"]
    InvoiceModule -->|NumberingPort| NumberingModule
    PrismaModule["PrismaModule"]
    ConfigModule["ConfigModule"]
    PrismaModule -->|ConfigService| ConfigModule
    MessagingModule__src_infrastructure_messaging_["MessagingModule (src/infrastructure/messaging)"]
    MessagingModule__src_infrastructure_messaging__2["MessagingModule__src_infrastructure_messaging_"]
    MessagingModule__src_infrastructure_messaging__2 -->|ConfigService| ConfigModule
    NotificationModule__src_infrastructure_notification_["NotificationModule (src/infrastructure/notification)"]
    NotificationModule__src_infrastructure_notification__2["NotificationModule__src_infrastructure_notification_"]
    NotificationModule__src_infrastructure_notification__2 -->|ConfigService| ConfigModule
    AuditModule["AuditModule"]
    ContextModule__src_platform_context_["ContextModule (src/platform/context)"]
    ContextModule__src_platform_context__2["ContextModule__src_platform_context_"]
    AuditModule -->|RequestContextPort| ContextModule__src_platform_context__2
    BatchOperationModule["BatchOperationModule"]
    BatchOperationModule -->|RequestContextPort| ContextModule__src_platform_context__2
    BatchOperationModule -->|OutboxWriterPort| OutboxModule
    BatchOperationModule -->|ConfigService| ConfigModule
    BatchOperationModule -->|NumberingPort| NumberingModule
    ConfigurationModule -->|ConfigService| ConfigModule
    DatabaseModule -->|ConfigService| ConfigModule
    DatabaseModule -->|PrismaWriteService| PrismaModule
    ImportModule["ImportModule"]
    ImportModule -->|RequestContextPort| ContextModule__src_platform_context__2
    ImportModule -->|OutboxWriterPort| OutboxModule
    ImportModule -->|ConfigService| ConfigModule
    StorageModule__src_platform_storage_["StorageModule (src/platform/storage)"]
    StorageModule__src_platform_storage__2["StorageModule__src_platform_storage_"]
    ImportModule -->|FileStoragePort| StorageModule__src_platform_storage__2
    ImportModule -->|NumberingPort| NumberingModule
    MessagingModule__src_platform_messaging_["MessagingModule (src/platform/messaging)"]
    MessagingModule__src_platform_messaging__2["MessagingModule__src_platform_messaging_"]
    MessagingModule__src_platform_messaging__2 -->|ConfigService| ConfigModule
    NotificationModule__src_platform_notification_["NotificationModule (src/platform/notification)"]
    NotificationModule__src_platform_notification__2["NotificationModule__src_platform_notification_"]
    NotificationModule__src_platform_notification__2 -->|LoggerPort| ObservabilityModule
    ObservabilityModule -->|ConfigService| ConfigModule
    OutboxModule -->|RequestContextPort| ContextModule__src_platform_context__2
    EventsModule["EventsModule"]
    OutboxModule -->|MessageRoutingPolicy, InProcessEventBus| EventsModule
    OutboxModule -->|RabbitMqPublisher, KafkaPublisher, SqsPublisher| MessagingModule__src_platform_messaging__2
    OutboxModule -->|ConfigService| ConfigModule
    RecurringModule -->|RequestContextPort| ContextModule__src_platform_context__2
    RecurringModule -->|OutboxWriterPort| OutboxModule
    SchedulerModule["SchedulerModule"]
    RecurringModule -->|SchedulerPort, ScheduledJobHandlerRegistry| SchedulerModule
    ConditionEngineModule["ConditionEngineModule"]
    RecurringModule -->|ConditionEvaluator| ConditionEngineModule
    SchedulerModule -->|ConfigService| ConfigModule
    CacheModule__src_infrastructure_cache_["CacheModule (src/infrastructure/cache)"]
    CacheModule__src_infrastructure_cache__2["CacheModule__src_infrastructure_cache_"]
    SchedulerModule -->|RedisService| CacheModule__src_infrastructure_cache__2
    SchedulerModule -->|RabbitMqPublisher| MessagingModule__src_platform_messaging__2
```

---

## Per-module wiring

### Business — party/vendor

#### VendorModule — `src/business/party/vendor/vendor.module.ts`

imports: PlatformModule · exports: VendorForPurchasePort

```mermaid
flowchart LR
    VendorForPurchasePort["VendorForPurchasePort"]
    VendorForPurchaseFacade["VendorForPurchaseFacade"]
    VendorForPurchasePort -.->|useExisting| VendorForPurchaseFacade
    VendorCommandRepository["VendorCommandRepository"]
    PrismaVendorCommandRepository["PrismaVendorCommandRepository"]
    VendorCommandRepository -.->|useClass| PrismaVendorCommandRepository
    VendorQuery["VendorQuery"]
    PrismaVendorQueryRepository["PrismaVendorQueryRepository"]
    VendorQuery -.->|useClass| PrismaVendorQueryRepository
    VendorIntegrationPort["VendorIntegrationPort"]
    OutboxAdapter["OutboxAdapter"]
    VendorIntegrationPort -.->|useClass| OutboxAdapter
    CompanyConfigPort["CompanyConfigPort"]
    CompanyConfigAdapter["CompanyConfigAdapter"]
    CompanyConfigPort -.->|useClass| CompanyConfigAdapter
    VendorController["VendorController"]
    CreateVendorUseCase["CreateVendorUseCase"]
    VendorController -->|injects| CreateVendorUseCase
    UpdateVendorUseCase["UpdateVendorUseCase"]
    VendorController -->|injects| UpdateVendorUseCase
    VendorStatusUseCase["VendorStatusUseCase"]
    VendorController -->|injects| VendorStatusUseCase
    GetVendorUseCase["GetVendorUseCase"]
    VendorController -->|injects| GetVendorUseCase
    ListVendorsUseCase["ListVendorsUseCase"]
    VendorController -->|injects| ListVendorsUseCase
    VendorImportHandler["VendorImportHandler"]
    VendorImportHandler -->|injects| CreateVendorUseCase
    CreateVendorUseCase -->|injects| VendorCommandRepository
    CreateVendorUseCase -->|injects| VendorIntegrationPort
    CreateVendorUseCase -->|injects| CompanyConfigPort
    UpdateVendorUseCase -->|injects| VendorCommandRepository
    UpdateVendorUseCase -->|injects| VendorIntegrationPort
    UpdateVendorUseCase -->|injects| CompanyConfigPort
    VendorStatusUseCase -->|injects| VendorCommandRepository
    VendorStatusUseCase -->|injects| VendorIntegrationPort
    VendorStatusUseCase -->|injects| CompanyConfigPort
    GetVendorUseCase -->|injects| VendorQuery
    ListVendorsUseCase -->|injects| VendorQuery
    GetOrderableVendorUseCase["GetOrderableVendorUseCase"]
    GetOrderableVendorUseCase -->|injects| VendorQuery
    VendorForPurchaseFacade -->|injects| GetOrderableVendorUseCase
    VendorForPurchaseFacade -->|injects| GetOrderableVendorUseCase
    TransactionHost__library_["TransactionHost (library)"]
    PrismaVendorCommandRepository -->|injects| TransactionHost__library_
    PrismaReadPort["PrismaReadPort"]
    PrismaVendorQueryRepository -->|injects via DatabaseModule| PrismaReadPort
    OutboxWriterPort["OutboxWriterPort"]
    OutboxAdapter -->|injects via OutboxModule| OutboxWriterPort
    CompanyConfigAdapter -->|injects via ConfigurationModule| CompanyConfigPort
    VendorModule_bootstrap["VendorModule bootstrap"]
    ImportHandlerRegistry["ImportHandlerRegistry"]
    VendorModule_bootstrap -->|registers or injects| ImportHandlerRegistry
    VendorModule_bootstrap -->|registers or injects| VendorImportHandler
```

### Business — procurement

#### GoodReceiptNoteModule — `src/business/procurement/good-receipt-note/good-receipt-note.module.ts`

imports: PlatformModule, PurchaseOrderModule · exports: GrnForPurchaseOrderPort

```mermaid
flowchart LR
    GrnForPurchaseOrderPort["GrnForPurchaseOrderPort"]
    GrnForPurchaseOrderFacade["GrnForPurchaseOrderFacade"]
    GrnForPurchaseOrderPort -.->|useExisting| GrnForPurchaseOrderFacade
    GrnCommandRepository["GrnCommandRepository"]
    PrismaGrnCommandRepository["PrismaGrnCommandRepository"]
    GrnCommandRepository -.->|useClass| PrismaGrnCommandRepository
    GrnQuery["GrnQuery"]
    PrismaGrnQueryRepository["PrismaGrnQueryRepository"]
    GrnQuery -.->|useClass| PrismaGrnQueryRepository
    GrnIntegrationPort["GrnIntegrationPort"]
    OutboxAdapter["OutboxAdapter"]
    GrnIntegrationPort -.->|useClass| OutboxAdapter
    CompanyConfigPort["CompanyConfigPort"]
    CompanyConfigAdapter["CompanyConfigAdapter"]
    CompanyConfigPort -.->|useClass| CompanyConfigAdapter
    PurchaseOrderPort["PurchaseOrderPort"]
    PurchaseOrderAdapter["PurchaseOrderAdapter"]
    PurchaseOrderPort -.->|useClass| PurchaseOrderAdapter
    GrnController["GrnController"]
    CreateGrnUseCase["CreateGrnUseCase"]
    GrnController -->|injects| CreateGrnUseCase
    AddGrnLineUseCase["AddGrnLineUseCase"]
    GrnController -->|injects| AddGrnLineUseCase
    ReceiveGrnUseCase["ReceiveGrnUseCase"]
    GrnController -->|injects| ReceiveGrnUseCase
    CompleteGrnUseCase["CompleteGrnUseCase"]
    GrnController -->|injects| CompleteGrnUseCase
    GetGrnUseCase["GetGrnUseCase"]
    GrnController -->|injects| GetGrnUseCase
    ListGrnsUseCase["ListGrnsUseCase"]
    GrnController -->|injects| ListGrnsUseCase
    GrnBatchOperationAdapter["GrnBatchOperationAdapter"]
    GrnBatchOperationAdapter -->|injects| GetGrnUseCase
    GrnBatchOperationAdapter -->|injects| ReceiveGrnUseCase
    GrnBatchOperationAdapter -->|injects| CompleteGrnUseCase
    CreateGrnUseCase -->|injects| GrnCommandRepository
    CreateGrnUseCase -->|injects| PurchaseOrderPort
    CreateGrnUseCase -->|injects| GrnIntegrationPort
    CreateGrnUseCase -->|injects| CompanyConfigPort
    AddGrnLineUseCase -->|injects| GrnCommandRepository
    AddGrnLineUseCase -->|injects| GrnIntegrationPort
    ReceiveGrnUseCase -->|injects| GrnCommandRepository
    ReceiveGrnUseCase -->|injects| GrnIntegrationPort
    CompleteGrnUseCase -->|injects| GrnCommandRepository
    CompleteGrnUseCase -->|injects| GrnIntegrationPort
    CompleteGrnUseCase -->|injects| CompanyConfigPort
    GetGrnUseCase -->|injects| GrnQuery
    ListGrnsUseCase -->|injects| GrnQuery
    GrnForPurchaseOrderFacade -->|injects| GetGrnUseCase
    GrnForPurchaseOrderFacade -->|injects| GetGrnUseCase
    TransactionHost__library_["TransactionHost (library)"]
    PrismaGrnCommandRepository -->|injects| TransactionHost__library_
    PrismaReadPort["PrismaReadPort"]
    PrismaGrnQueryRepository -->|injects via DatabaseModule| PrismaReadPort
    OutboxWriterPort["OutboxWriterPort"]
    OutboxAdapter -->|injects via OutboxModule| OutboxWriterPort
    CompanyConfigAdapter -->|injects via ConfigurationModule| CompanyConfigPort
    PurchaseOrderForGrnPort["PurchaseOrderForGrnPort"]
    PurchaseOrderAdapter -->|injects via PurchaseOrderModule| PurchaseOrderForGrnPort
    GoodReceiptNoteModule_bootstrap["GoodReceiptNoteModule bootstrap"]
    BatchOperationHandlerRegistry["BatchOperationHandlerRegistry"]
    GoodReceiptNoteModule_bootstrap -->|registers or injects| BatchOperationHandlerRegistry
    GoodReceiptNoteModule_bootstrap -->|registers or injects| GrnBatchOperationAdapter
```

#### PurchaseOrderModule — `src/business/procurement/purchase-order/purchase-order.module.ts`

imports: PlatformModule, ProductModule, VendorModule · exports: PurchaseOrderForGrnPort

```mermaid
flowchart LR
    PurchaseOrderForGrnPort["PurchaseOrderForGrnPort"]
    PurchaseOrderForGrnFacade["PurchaseOrderForGrnFacade"]
    PurchaseOrderForGrnPort -.->|useExisting| PurchaseOrderForGrnFacade
    PurchaseOrderCommandRepository["PurchaseOrderCommandRepository"]
    PrismaPurchaseOrderCommandRepository["PrismaPurchaseOrderCommandRepository"]
    PurchaseOrderCommandRepository -.->|useClass| PrismaPurchaseOrderCommandRepository
    PurchaseOrderQuery["PurchaseOrderQuery"]
    PrismaPurchaseOrderQueryRepository["PrismaPurchaseOrderQueryRepository"]
    PurchaseOrderQuery -.->|useClass| PrismaPurchaseOrderQueryRepository
    PurchaseOrderIntegrationPort["PurchaseOrderIntegrationPort"]
    OutboxAdapter["OutboxAdapter"]
    PurchaseOrderIntegrationPort -.->|useClass| OutboxAdapter
    CompanyConfigPort["CompanyConfigPort"]
    CompanyConfigAdapter["CompanyConfigAdapter"]
    CompanyConfigPort -.->|useClass| CompanyConfigAdapter
    PurchasableProductPort["PurchasableProductPort"]
    PurchasableProductAdapter["PurchasableProductAdapter"]
    PurchasableProductPort -.->|useClass| PurchasableProductAdapter
    OrderableVendorPort["OrderableVendorPort"]
    OrderableVendorAdapter["OrderableVendorAdapter"]
    OrderableVendorPort -.->|useClass| OrderableVendorAdapter
    PurchaseOrderController["PurchaseOrderController"]
    CreatePurchaseOrderUseCase["CreatePurchaseOrderUseCase"]
    PurchaseOrderController -->|injects| CreatePurchaseOrderUseCase
    AddPurchaseOrderLineUseCase["AddPurchaseOrderLineUseCase"]
    PurchaseOrderController -->|injects| AddPurchaseOrderLineUseCase
    RemovePurchaseOrderLineUseCase["RemovePurchaseOrderLineUseCase"]
    PurchaseOrderController -->|injects| RemovePurchaseOrderLineUseCase
    PurchaseOrderTransitionUseCase["PurchaseOrderTransitionUseCase"]
    PurchaseOrderController -->|injects| PurchaseOrderTransitionUseCase
    GetPurchaseOrderUseCase["GetPurchaseOrderUseCase"]
    PurchaseOrderController -->|injects| GetPurchaseOrderUseCase
    ListPurchaseOrdersUseCase["ListPurchaseOrdersUseCase"]
    PurchaseOrderController -->|injects| ListPurchaseOrdersUseCase
    PurchaseOrderBatchOperationAdapter["PurchaseOrderBatchOperationAdapter"]
    PurchaseOrderBatchOperationAdapter -->|injects| GetPurchaseOrderUseCase
    PurchaseOrderBatchOperationAdapter -->|injects| PurchaseOrderTransitionUseCase
    CreatePurchaseOrderUseCase -->|injects| PurchaseOrderCommandRepository
    CreatePurchaseOrderUseCase -->|injects| OrderableVendorPort
    CreatePurchaseOrderUseCase -->|injects| PurchaseOrderIntegrationPort
    CreatePurchaseOrderUseCase -->|injects| CompanyConfigPort
    AddPurchaseOrderLineUseCase -->|injects| PurchaseOrderCommandRepository
    AddPurchaseOrderLineUseCase -->|injects| PurchasableProductPort
    AddPurchaseOrderLineUseCase -->|injects| PurchaseOrderIntegrationPort
    AddPurchaseOrderLineUseCase -->|injects| CompanyConfigPort
    RemovePurchaseOrderLineUseCase -->|injects| PurchaseOrderCommandRepository
    RemovePurchaseOrderLineUseCase -->|injects| PurchaseOrderIntegrationPort
    RemovePurchaseOrderLineUseCase -->|injects| CompanyConfigPort
    PurchaseOrderTransitionUseCase -->|injects| PurchaseOrderCommandRepository
    PurchaseOrderTransitionUseCase -->|injects| PurchaseOrderIntegrationPort
    PurchaseOrderTransitionUseCase -->|injects| CompanyConfigPort
    GetPurchaseOrderUseCase -->|injects| PurchaseOrderQuery
    ListPurchaseOrdersUseCase -->|injects| PurchaseOrderQuery
    PurchaseOrderForGrnFacade -->|injects| GetPurchaseOrderUseCase
    PurchaseOrderForGrnFacade -->|injects| GetPurchaseOrderUseCase
    TransactionHost__library_["TransactionHost (library)"]
    PrismaPurchaseOrderCommandRepository -->|injects| TransactionHost__library_
    PrismaReadPort["PrismaReadPort"]
    PrismaPurchaseOrderQueryRepository -->|injects via DatabaseModule| PrismaReadPort
    OutboxWriterPort["OutboxWriterPort"]
    OutboxAdapter -->|injects via OutboxModule| OutboxWriterPort
    CompanyConfigAdapter -->|injects via ConfigurationModule| CompanyConfigPort
    ProductForPurchasePort["ProductForPurchasePort"]
    PurchasableProductAdapter -->|injects via ProductModule| ProductForPurchasePort
    VendorForPurchasePort["VendorForPurchasePort"]
    OrderableVendorAdapter -->|injects via VendorModule| VendorForPurchasePort
    PurchaseOrderModule_bootstrap["PurchaseOrderModule bootstrap"]
    BatchOperationHandlerRegistry["BatchOperationHandlerRegistry"]
    PurchaseOrderModule_bootstrap -->|registers or injects| BatchOperationHandlerRegistry
    PurchaseOrderModule_bootstrap -->|registers or injects| PurchaseOrderBatchOperationAdapter
```

### Business — sales/invoice

#### InvoiceModule — `src/business/sales/invoice/invoice.module.ts`

imports: PlatformModule · exports: InvoiceForReportsPort

```mermaid
flowchart LR
    InvoiceForReportsPort["InvoiceForReportsPort"]
    InvoiceForReportsFacade["InvoiceForReportsFacade"]
    InvoiceForReportsPort -.->|useExisting| InvoiceForReportsFacade
    InvoiceCommandRepository["InvoiceCommandRepository"]
    PrismaInvoiceCommandRepository["PrismaInvoiceCommandRepository"]
    InvoiceCommandRepository -.->|useClass| PrismaInvoiceCommandRepository
    InvoiceQuery["InvoiceQuery"]
    PrismaInvoiceQueryRepository["PrismaInvoiceQueryRepository"]
    InvoiceQuery -.->|useClass| PrismaInvoiceQueryRepository
    InvoiceIntegrationPort["InvoiceIntegrationPort"]
    OutboxAdapter["OutboxAdapter"]
    InvoiceIntegrationPort -.->|useClass| OutboxAdapter
    CompanyConfigPort["CompanyConfigPort"]
    CompanyConfigAdapter["CompanyConfigAdapter"]
    CompanyConfigPort -.->|useClass| CompanyConfigAdapter
    NumberingPort["NumberingPort"]
    NumberingAdapter["NumberingAdapter"]
    NumberingPort -.->|useClass| NumberingAdapter
    InvoiceController["InvoiceController"]
    CreateInvoiceUseCase["CreateInvoiceUseCase"]
    InvoiceController -->|injects| CreateInvoiceUseCase
    PostInvoiceUseCase["PostInvoiceUseCase"]
    InvoiceController -->|injects| PostInvoiceUseCase
    GetInvoiceUseCase["GetInvoiceUseCase"]
    InvoiceController -->|injects| GetInvoiceUseCase
    ListInvoicesUseCase["ListInvoicesUseCase"]
    InvoiceController -->|injects| ListInvoicesUseCase
    CreateInvoiceUseCase -->|injects| InvoiceCommandRepository
    CreateInvoiceUseCase -->|injects| InvoiceIntegrationPort
    CreateInvoiceUseCase -->|injects| CompanyConfigPort
    CreateInvoiceUseCase -->|injects| NumberingPort
    PostInvoiceUseCase -->|injects| InvoiceCommandRepository
    PostInvoiceUseCase -->|injects| InvoiceIntegrationPort
    GetInvoiceUseCase -->|injects| InvoiceQuery
    ListInvoicesUseCase -->|injects| InvoiceQuery
    GenerateRecurringInvoiceUseCase["GenerateRecurringInvoiceUseCase"]
    GenerateRecurringInvoiceUseCase -->|injects| CreateInvoiceUseCase
    GenerateRecurringInvoiceUseCase -->|injects| GetInvoiceUseCase
    GenerateRecurringInvoiceUseCase -->|injects| PostInvoiceUseCase
    RecurringExecutionPort["RecurringExecutionPort"]
    GenerateRecurringInvoiceUseCase -->|injects via RecurringModule| RecurringExecutionPort
    LoggerPort["LoggerPort"]
    GenerateRecurringInvoiceUseCase -->|injects via ObservabilityModule| LoggerPort
    RecurringOccurrenceRequestedRabbitMQListener["RecurringOccurrenceRequestedRabbitMQListener"]
    RecurringOccurrenceRequestedRabbitMQListener -->|injects| GenerateRecurringInvoiceUseCase
    InvoiceForReportsFacade -->|injects| GetInvoiceUseCase
    InvoiceForReportsFacade -->|injects| GetInvoiceUseCase
    TransactionHost__library_["TransactionHost (library)"]
    PrismaInvoiceCommandRepository -->|injects| TransactionHost__library_
    PrismaReadPort["PrismaReadPort"]
    PrismaInvoiceQueryRepository -->|injects via DatabaseModule| PrismaReadPort
    OutboxWriterPort["OutboxWriterPort"]
    OutboxAdapter -->|injects via OutboxModule| OutboxWriterPort
    CompanyConfigAdapter -->|injects via ConfigurationModule| CompanyConfigPort
    NumberingAdapter -->|injects via NumberingModule| NumberingPort
```

### Platform — core (outbox · events · messaging · context · database)

#### ContextModule (src/platform/context) — `src/platform/context/context.module.ts`

imports: — · exports: RequestContextPort

```mermaid
flowchart LR
    RequestContextPort["RequestContextPort"]
    ClsRequestContextService["ClsRequestContextService"]
    RequestContextPort -.->|useClass| ClsRequestContextService
    ClsService__library_["ClsService (library)"]
    ClsRequestContextService -->|injects| ClsService__library_
    ClsRequestContextService -->|injects| ClsService__library_
```

#### DatabaseModule — `src/platform/database/database.module.ts`

imports: InfrastructureModule · exports: PrismaReadPort

```mermaid
flowchart LR
    PrismaReadPort["PrismaReadPort"]
    PrismaReadService["PrismaReadService"]
    PrismaReadPort -.->|useExisting| PrismaReadService
    ConfigService["ConfigService"]
    PrismaReadService -->|injects via ConfigModule| ConfigService
    PrismaWriteService["PrismaWriteService"]
    PrismaReadService -->|injects via PrismaModule| PrismaWriteService
```

#### EventsModule — `src/platform/events/events.module.ts`

imports: — · exports: InProcessEventBus, MessageRoutingPolicy

```mermaid
flowchart LR
    InProcessEventBus["InProcessEventBus"]
    NestEventBusAdapter["NestEventBusAdapter"]
    InProcessEventBus -.->|useExisting| NestEventBusAdapter
    MessageRoutingPolicy["MessageRoutingPolicy"]
    DefaultMessageRoutingPolicy["DefaultMessageRoutingPolicy"]
    MessageRoutingPolicy -.->|useExisting| DefaultMessageRoutingPolicy
    EventEmitter2__library_["EventEmitter2 (library)"]
    NestEventBusAdapter -->|injects| EventEmitter2__library_
    NestEventBusAdapter -->|injects| EventEmitter2__library_
```

#### MessagingModule (src/platform/messaging) — `src/platform/messaging/messaging.module.ts`

imports: InfraMessagingModule · exports: MessagePublisher, RabbitMqPublisher, KafkaPublisher, SqsPublisher

```mermaid
flowchart LR
    MessagePublisher["MessagePublisher"]
    RabbitMQPublisherAdapter["RabbitMQPublisherAdapter"]
    MessagePublisher -.->|useExisting| RabbitMQPublisherAdapter
    RabbitMqPublisher["RabbitMqPublisher"]
    RabbitMqPublisher -.->|useExisting| RabbitMQPublisherAdapter
    KafkaPublisher["KafkaPublisher"]
    KafkaPublisherAdapter["KafkaPublisherAdapter"]
    KafkaPublisher -.->|useExisting| KafkaPublisherAdapter
    SqsPublisher["SqsPublisher"]
    SqsPublisherAdapter["SqsPublisherAdapter"]
    SqsPublisher -.->|useExisting| SqsPublisherAdapter
    KafkaService["KafkaService"]
    KafkaPublisherAdapter -->|injects| KafkaService
    AmqpConnection__library_["AmqpConnection (library)"]
    RabbitMQPublisherAdapter -->|injects| AmqpConnection__library_
    ConfigService["ConfigService"]
    RabbitMQPublisherAdapter -->|injects via ConfigModule| ConfigService
    SqsService["SqsService"]
    SqsPublisherAdapter -->|injects| SqsService
    SqsPublisherAdapter -->|injects via ConfigModule| ConfigService
    RabbitMQPublisherAdapter -->|injects| AmqpConnection__library_
    RabbitMQPublisherAdapter -->|injects via ConfigModule| ConfigService
    RabbitMQPublisherAdapter -->|injects| AmqpConnection__library_
    RabbitMQPublisherAdapter -->|injects via ConfigModule| ConfigService
    KafkaPublisherAdapter -->|injects| KafkaService
    SqsPublisherAdapter -->|injects| SqsService
    SqsPublisherAdapter -->|injects via ConfigModule| ConfigService
```

#### OutboxModule — `src/platform/outbox/outbox.module.ts`

imports: MessagingModule, EventsModule, ContextModule · exports: OutboxWriterPort

```mermaid
flowchart LR
    OutboxRepository["OutboxRepository"]
    PrismaOutboxRepository["PrismaOutboxRepository"]
    OutboxRepository -.->|useExisting| PrismaOutboxRepository
    OutboxWriterPort["OutboxWriterPort"]
    OutboxWriter["OutboxWriter"]
    OutboxWriterPort -.->|useExisting| OutboxWriter
    TransactionHost__library_["TransactionHost (library)"]
    PrismaOutboxRepository -->|injects| TransactionHost__library_
    PrismaOutboxRepository -->|injects| TransactionHost__library_
    OutboxWriter -->|injects| OutboxRepository
    RequestContextPort["RequestContextPort"]
    OutboxWriter -->|injects via ContextModule| RequestContextPort
    OutboxPublisher["OutboxPublisher"]
    OutboxPublisher -->|injects| OutboxRepository
    MessageRoutingPolicy["MessageRoutingPolicy"]
    OutboxPublisher -->|injects via EventsModule| MessageRoutingPolicy
    InProcessEventBus["InProcessEventBus"]
    OutboxPublisher -->|injects via EventsModule| InProcessEventBus
    RabbitMqPublisher["RabbitMqPublisher"]
    OutboxPublisher -->|injects via MessagingModule| RabbitMqPublisher
    KafkaPublisher["KafkaPublisher"]
    OutboxPublisher -->|injects via MessagingModule| KafkaPublisher
    SqsPublisher["SqsPublisher"]
    OutboxPublisher -->|injects via MessagingModule| SqsPublisher
    ConfigService["ConfigService"]
    OutboxPublisher -->|injects via ConfigModule| ConfigService
    OutboxScheduler["OutboxScheduler"]
    OutboxScheduler -->|injects| OutboxPublisher
    OutboxWriter -->|injects| OutboxRepository
    OutboxWriter -->|injects via ContextModule| RequestContextPort
```

### Platform — capabilities (configuration · audit · numbering · notification · cache · storage · observability)

#### AuditModule — `src/platform/audit/audit.module.ts`

imports: ContextModule · exports: AuditPort

```mermaid
flowchart LR
    AuditPort["AuditPort"]
    PrismaAuditService["PrismaAuditService"]
    AuditPort -.->|useExisting| PrismaAuditService
    TransactionHost__library_["TransactionHost (library)"]
    PrismaAuditService -->|injects| TransactionHost__library_
    RequestContextPort["RequestContextPort"]
    PrismaAuditService -->|injects via ContextModule| RequestContextPort
    PrismaAuditService -->|injects| TransactionHost__library_
    PrismaAuditService -->|injects via ContextModule| RequestContextPort
```

#### CacheModule (src/platform/cache) — `src/platform/cache/cache.module.ts`

imports: — · exports: CachePort

```mermaid
flowchart LR
    CachePort["CachePort"]
    CacheAdapter["CacheAdapter"]
    CachePort -.->|useExisting| CacheAdapter
```

#### ConfigurationModule — `src/platform/configuration/configuration.module.ts`

imports: — · exports: CompanyConfigPort

```mermaid
flowchart LR
    CompanyConfigPort["CompanyConfigPort"]
    PrismaCompanyConfigAdapter["PrismaCompanyConfigAdapter"]
    CompanyConfigPort -.->|useExisting| PrismaCompanyConfigAdapter
    TransactionHost__library_["TransactionHost (library)"]
    PrismaCompanyConfigAdapter -->|injects| TransactionHost__library_
    ConfigService["ConfigService"]
    PrismaCompanyConfigAdapter -->|injects via ConfigModule| ConfigService
    PrismaCompanyConfigAdapter -->|injects| TransactionHost__library_
    PrismaCompanyConfigAdapter -->|injects via ConfigModule| ConfigService
```

#### NotificationModule (src/platform/notification) — `src/platform/notification/notification.module.ts`

imports: InfraNotificationModule, ObservabilityModule · exports: EmailPort, NotificationPort, NotificationDispatchPort

```mermaid
flowchart LR
    EmailPort["EmailPort"]
    SesEmailAdapter["SesEmailAdapter"]
    EmailPort -.->|useClass| SesEmailAdapter
    NotificationPort["NotificationPort"]
    SnsNotificationAdapter["SnsNotificationAdapter"]
    NotificationPort -.->|useClass| SnsNotificationAdapter
    NotificationDispatchPort["NotificationDispatchPort"]
    NotificationDispatchService["NotificationDispatchService"]
    NotificationDispatchPort -.->|useExisting| NotificationDispatchService
    SesService["SesService"]
    SesEmailAdapter -->|injects| SesService
    LoggerPort["LoggerPort"]
    SesEmailAdapter -->|injects via ObservabilityModule| LoggerPort
    SnsService["SnsService"]
    SnsNotificationAdapter -->|injects| SnsService
    SnsNotificationAdapter -->|injects via ObservabilityModule| LoggerPort
    NotificationDispatchService -->|injects| EmailPort
    NotificationDispatchService -->|injects| NotificationPort
    SesEmailAdapter -->|injects| SesService
    SesEmailAdapter -->|injects via ObservabilityModule| LoggerPort
    SnsNotificationAdapter -->|injects| SnsService
    SnsNotificationAdapter -->|injects via ObservabilityModule| LoggerPort
    NotificationDispatchService -->|injects| EmailPort
    NotificationDispatchService -->|injects| NotificationPort
```

#### NumberingModule — `src/platform/numbering/numbering.module.ts`

imports: — · exports: NumberingPort

```mermaid
flowchart LR
    NumberingPort["NumberingPort"]
    PrismaNumberingService["PrismaNumberingService"]
    NumberingPort -.->|useExisting| PrismaNumberingService
    TransactionHost__library_["TransactionHost (library)"]
    PrismaNumberingService -->|injects| TransactionHost__library_
    PrismaNumberingService -->|injects| TransactionHost__library_
```

#### ObservabilityModule — `src/platform/observability/observability.module.ts`

imports: — · exports: LoggerPort, MetricsPort, ErrorTrackingPort

```mermaid
flowchart LR
    LoggerPort["LoggerPort"]
    ConsoleLoggerAdapter["ConsoleLoggerAdapter"]
    LoggerPort -.->|useClass| ConsoleLoggerAdapter
    MetricsPort["MetricsPort"]
    PrometheusMetricsAdapter["PrometheusMetricsAdapter"]
    MetricsPort -.->|useClass| PrometheusMetricsAdapter
    ErrorTrackingPort["ErrorTrackingPort"]
    SentryErrorTrackingAdapter["SentryErrorTrackingAdapter"]
    ErrorTrackingPort -.->|useClass| SentryErrorTrackingAdapter
    ConfigService["ConfigService"]
    SentryErrorTrackingAdapter -->|injects via ConfigModule| ConfigService
```

#### StorageModule (src/platform/storage) — `src/platform/storage/storage.module.ts`

imports: InfraStorageModule · exports: FileStoragePort

```mermaid
flowchart LR
    FileStoragePort["FileStoragePort"]
    S3FileStorageAdapter["S3FileStorageAdapter"]
    FileStoragePort -.->|useClass| S3FileStorageAdapter
    FileStorageService__library_["FileStorageService (library)"]
    S3FileStorageAdapter -->|injects| FileStorageService__library_
    S3FileStorageAdapter -->|injects| FileStorageService__library_
```

### Platform — services (scheduler · recurring · condition-engine · batch-operation · import)

#### BatchOperationModule — `src/platform/batch-operation/batch-operation.module.ts`

imports: ContextModule, NumberingModule, OutboxModule, BullModule.registerQueue({ name: BATCH_OPERATION_QUEUE_NAME }) · exports: BatchOperationHandlerRegistry, CreateBatchOperationJobPort, ValidateBatchOperationPort, ProcessBatchOperationRowPort, GetBatchOperationJobStatusPort, ListBatchOperationJobsPort, ListBatchOperationJobRowsPort, CancelBatchOperationJobPort

```mermaid
flowchart LR
    BatchOperationJobRepositoryPort["BatchOperationJobRepositoryPort"]
    PrismaBatchOperationJobRepository["PrismaBatchOperationJobRepository"]
    BatchOperationJobRepositoryPort -.->|useExisting| PrismaBatchOperationJobRepository
    BatchOperationJobRowRepositoryPort["BatchOperationJobRowRepositoryPort"]
    BatchOperationJobRowRepositoryPort -.->|useExisting| PrismaBatchOperationJobRepository
    BatchOperationJobOutboxWriterPort["BatchOperationJobOutboxWriterPort"]
    PrismaBatchOperationJobOutboxWriter["PrismaBatchOperationJobOutboxWriter"]
    BatchOperationJobOutboxWriterPort -.->|useExisting| PrismaBatchOperationJobOutboxWriter
    BatchOperationQueuePublisherPort["BatchOperationQueuePublisherPort"]
    BullMqBatchOperationQueuePublisher["BullMqBatchOperationQueuePublisher"]
    BatchOperationQueuePublisherPort -.->|useExisting| BullMqBatchOperationQueuePublisher
    CreateBatchOperationJobPort["CreateBatchOperationJobPort"]
    CreateBatchOperationJobUseCase["CreateBatchOperationJobUseCase"]
    CreateBatchOperationJobPort -.->|useExisting| CreateBatchOperationJobUseCase
    ValidateBatchOperationPort["ValidateBatchOperationPort"]
    ValidateBatchOperationUseCase["ValidateBatchOperationUseCase"]
    ValidateBatchOperationPort -.->|useExisting| ValidateBatchOperationUseCase
    ProcessBatchOperationRowPort["ProcessBatchOperationRowPort"]
    ProcessBatchOperationRowUseCase["ProcessBatchOperationRowUseCase"]
    ProcessBatchOperationRowPort -.->|useExisting| ProcessBatchOperationRowUseCase
    GetBatchOperationJobStatusPort["GetBatchOperationJobStatusPort"]
    GetBatchOperationJobStatusUseCase["GetBatchOperationJobStatusUseCase"]
    GetBatchOperationJobStatusPort -.->|useExisting| GetBatchOperationJobStatusUseCase
    ListBatchOperationJobsPort["ListBatchOperationJobsPort"]
    ListBatchOperationJobsUseCase["ListBatchOperationJobsUseCase"]
    ListBatchOperationJobsPort -.->|useExisting| ListBatchOperationJobsUseCase
    ListBatchOperationJobRowsPort["ListBatchOperationJobRowsPort"]
    ListBatchOperationJobRowsUseCase["ListBatchOperationJobRowsUseCase"]
    ListBatchOperationJobRowsPort -.->|useExisting| ListBatchOperationJobRowsUseCase
    CancelBatchOperationJobPort["CancelBatchOperationJobPort"]
    CancelBatchOperationJobUseCase["CancelBatchOperationJobUseCase"]
    CancelBatchOperationJobPort -.->|useExisting| CancelBatchOperationJobUseCase
    BatchOperationController["BatchOperationController"]
    BatchOperationController -->|injects| CreateBatchOperationJobPort
    BatchOperationController -->|injects| ValidateBatchOperationPort
    BatchOperationController -->|injects| GetBatchOperationJobStatusPort
    BatchOperationController -->|injects| ListBatchOperationJobsPort
    BatchOperationController -->|injects| ListBatchOperationJobRowsPort
    BatchOperationController -->|injects| CancelBatchOperationJobPort
    BatchOperationHandlerRegistry["BatchOperationHandlerRegistry"]
    BatchOperationController -->|injects| BatchOperationHandlerRegistry
    RequestContextPort["RequestContextPort"]
    BatchOperationController -->|injects via ContextModule| RequestContextPort
    TransactionHost__library_["TransactionHost (library)"]
    PrismaBatchOperationJobRepository -->|injects| TransactionHost__library_
    PrismaBatchOperationJobRepository -->|injects| TransactionHost__library_
    PrismaBatchOperationJobRepository -->|injects| TransactionHost__library_
    OutboxWriterPort["OutboxWriterPort"]
    PrismaBatchOperationJobOutboxWriter -->|injects via OutboxModule| OutboxWriterPort
    PrismaBatchOperationJobOutboxWriter -->|injects via OutboxModule| OutboxWriterPort
    Queue__library_["Queue (library)"]
    BullMqBatchOperationQueuePublisher -->|injects| Queue__library_
    ConfigService["ConfigService"]
    BullMqBatchOperationQueuePublisher -->|injects via ConfigModule| ConfigService
    BullMqBatchOperationQueuePublisher -->|injects| Queue__library_
    BullMqBatchOperationQueuePublisher -->|injects via ConfigModule| ConfigService
    BullMqBatchOperationWorker["BullMqBatchOperationWorker"]
    BatchOperationWorker["BatchOperationWorker"]
    BullMqBatchOperationWorker -->|injects| BatchOperationWorker
    BatchOperationWorker -->|injects| BatchOperationJobRepositoryPort
    BatchOperationWorker -->|injects| BatchOperationJobRowRepositoryPort
    BatchOperationWorker -->|injects| ProcessBatchOperationRowPort
    BatchOperationWorker -->|injects| BatchOperationJobOutboxWriterPort
    BatchOperationReconciliationConsumer["BatchOperationReconciliationConsumer"]
    BatchOperationReconciliationConsumer -->|injects| BatchOperationJobRepositoryPort
    BatchOperationReconciliationConsumer -->|injects| BatchOperationJobRowRepositoryPort
    BatchOperationReconciliationConsumer -->|injects| BatchOperationQueuePublisherPort
    BatchOperationReconciliationConsumer -->|injects via ConfigModule| ConfigService
    CreateBatchOperationJobUseCase -->|injects| BatchOperationJobRepositoryPort
    CreateBatchOperationJobUseCase -->|injects| BatchOperationHandlerRegistry
    CreateBatchOperationJobUseCase -->|injects| BatchOperationWorker
    CreateBatchOperationJobUseCase -->|injects| BatchOperationQueuePublisherPort
    NumberingPort["NumberingPort"]
    CreateBatchOperationJobUseCase -->|injects via NumberingModule| NumberingPort
    CreateBatchOperationJobUseCase -->|injects via ConfigModule| ConfigService
    CreateBatchOperationJobUseCase -->|injects| BatchOperationJobRepositoryPort
    CreateBatchOperationJobUseCase -->|injects| BatchOperationHandlerRegistry
    CreateBatchOperationJobUseCase -->|injects| BatchOperationWorker
    CreateBatchOperationJobUseCase -->|injects| BatchOperationQueuePublisherPort
    CreateBatchOperationJobUseCase -->|injects via NumberingModule| NumberingPort
    CreateBatchOperationJobUseCase -->|injects via ConfigModule| ConfigService
    ValidateBatchOperationUseCase -->|injects| BatchOperationHandlerRegistry
    ValidateBatchOperationUseCase -->|injects| BatchOperationHandlerRegistry
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationJobRepositoryPort
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationJobRowRepositoryPort
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationHandlerRegistry
    ProcessBatchOperationRowUseCase -->|injects via ConfigModule| ConfigService
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationJobRepositoryPort
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationJobRowRepositoryPort
    ProcessBatchOperationRowUseCase -->|injects| BatchOperationHandlerRegistry
    ProcessBatchOperationRowUseCase -->|injects via ConfigModule| ConfigService
    GetBatchOperationJobStatusUseCase -->|injects| BatchOperationJobRepositoryPort
    GetBatchOperationJobStatusUseCase -->|injects| BatchOperationJobRepositoryPort
    ListBatchOperationJobsUseCase -->|injects| BatchOperationJobRepositoryPort
    ListBatchOperationJobsUseCase -->|injects| BatchOperationJobRepositoryPort
    ListBatchOperationJobRowsUseCase -->|injects| BatchOperationJobRepositoryPort
    ListBatchOperationJobRowsUseCase -->|injects| BatchOperationJobRowRepositoryPort
    ListBatchOperationJobRowsUseCase -->|injects| BatchOperationJobRepositoryPort
    ListBatchOperationJobRowsUseCase -->|injects| BatchOperationJobRowRepositoryPort
    CancelBatchOperationJobUseCase -->|injects| BatchOperationJobRepositoryPort
    CancelBatchOperationJobUseCase -->|injects| BatchOperationJobRowRepositoryPort
    CancelBatchOperationJobUseCase -->|injects| BatchOperationJobRepositoryPort
    CancelBatchOperationJobUseCase -->|injects| BatchOperationJobRowRepositoryPort
```

#### ConditionEngineModule — `src/platform/condition-engine/condition-engine.module.ts`

imports: — · exports: ConditionEvaluator, FieldResolverRegistry

```mermaid
flowchart LR
    ConditionEvaluator["ConditionEvaluator"]
    ConditionEvaluationService["ConditionEvaluationService"]
    ConditionEvaluator -.->|useExisting| ConditionEvaluationService
    FieldResolverRegistry["FieldResolverRegistry"]
    ConditionEvaluationService -->|injects| FieldResolverRegistry
    ConditionEvaluationService -->|injects| FieldResolverRegistry
```

#### ImportModule — `src/platform/import/import.module.ts`

imports: ContextModule, NumberingModule, OutboxModule, StorageModule, BullModule.registerQueue({ name: IMPORT_QUEUE_NAME }) · exports: ImportHandlerRegistry, InitImportPort, CreateImportUploadPort, CreateImportJobPort, GetImportPreviewPort, UpdateImportMappingPort, GetImportReportPort, ExecuteImportJobPort, CancelImportJobPort, GetImportJobStatusPort, ListImportJobsPort

```mermaid
flowchart LR
    StorageObjectRepositoryPort["StorageObjectRepositoryPort"]
    PrismaStorageObjectRepository["PrismaStorageObjectRepository"]
    StorageObjectRepositoryPort -.->|useExisting| PrismaStorageObjectRepository
    ImportJobRepositoryPort["ImportJobRepositoryPort"]
    PrismaImportJobRepository["PrismaImportJobRepository"]
    ImportJobRepositoryPort -.->|useExisting| PrismaImportJobRepository
    ImportJobRowRepositoryPort["ImportJobRowRepositoryPort"]
    PrismaImportJobRowRepository["PrismaImportJobRowRepository"]
    ImportJobRowRepositoryPort -.->|useExisting| PrismaImportJobRowRepository
    ImportJobOutboxWriterPort["ImportJobOutboxWriterPort"]
    PrismaImportJobOutboxWriter["PrismaImportJobOutboxWriter"]
    ImportJobOutboxWriterPort -.->|useExisting| PrismaImportJobOutboxWriter
    ImportQueuePublisherPort["ImportQueuePublisherPort"]
    BullMqImportQueuePublisher["BullMqImportQueuePublisher"]
    ImportQueuePublisherPort -.->|useExisting| BullMqImportQueuePublisher
    InitImportPort["InitImportPort"]
    InitImportUseCase["InitImportUseCase"]
    InitImportPort -.->|useExisting| InitImportUseCase
    CreateImportUploadPort["CreateImportUploadPort"]
    CreateImportUploadUseCase["CreateImportUploadUseCase"]
    CreateImportUploadPort -.->|useExisting| CreateImportUploadUseCase
    CreateImportJobPort["CreateImportJobPort"]
    CreateImportJobUseCase["CreateImportJobUseCase"]
    CreateImportJobPort -.->|useExisting| CreateImportJobUseCase
    GetImportPreviewPort["GetImportPreviewPort"]
    GetImportPreviewUseCase["GetImportPreviewUseCase"]
    GetImportPreviewPort -.->|useExisting| GetImportPreviewUseCase
    UpdateImportMappingPort["UpdateImportMappingPort"]
    UpdateImportMappingUseCase["UpdateImportMappingUseCase"]
    UpdateImportMappingPort -.->|useExisting| UpdateImportMappingUseCase
    GetImportReportPort["GetImportReportPort"]
    GetImportReportUseCase["GetImportReportUseCase"]
    GetImportReportPort -.->|useExisting| GetImportReportUseCase
    ExecuteImportJobPort["ExecuteImportJobPort"]
    ExecuteImportJobUseCase["ExecuteImportJobUseCase"]
    ExecuteImportJobPort -.->|useExisting| ExecuteImportJobUseCase
    CancelImportJobPort["CancelImportJobPort"]
    CancelImportJobUseCase["CancelImportJobUseCase"]
    CancelImportJobPort -.->|useExisting| CancelImportJobUseCase
    GetImportJobStatusPort["GetImportJobStatusPort"]
    GetImportJobStatusUseCase["GetImportJobStatusUseCase"]
    GetImportJobStatusPort -.->|useExisting| GetImportJobStatusUseCase
    ListImportJobsPort["ListImportJobsPort"]
    ListImportJobsUseCase["ListImportJobsUseCase"]
    ListImportJobsPort -.->|useExisting| ListImportJobsUseCase
    ParseImportJobPort["ParseImportJobPort"]
    ParseImportJobUseCase["ParseImportJobUseCase"]
    ParseImportJobPort -.->|useExisting| ParseImportJobUseCase
    ValidateImportJobPort["ValidateImportJobPort"]
    ValidateImportJobUseCase["ValidateImportJobUseCase"]
    ValidateImportJobPort -.->|useExisting| ValidateImportJobUseCase
    RunImportExecutionPort["RunImportExecutionPort"]
    RunImportExecutionUseCase["RunImportExecutionUseCase"]
    RunImportExecutionPort -.->|useExisting| RunImportExecutionUseCase
    ImportController["ImportController"]
    ImportController -->|injects| InitImportPort
    ImportController -->|injects| CreateImportUploadPort
    ImportController -->|injects| CreateImportJobPort
    ImportController -->|injects| GetImportPreviewPort
    ImportController -->|injects| UpdateImportMappingPort
    ImportController -->|injects| GetImportReportPort
    ImportController -->|injects| ExecuteImportJobPort
    ImportController -->|injects| CancelImportJobPort
    ImportController -->|injects| GetImportJobStatusPort
    ImportController -->|injects| ListImportJobsPort
    ImportHandlerRegistry["ImportHandlerRegistry"]
    ImportController -->|injects| ImportHandlerRegistry
    RequestContextPort["RequestContextPort"]
    ImportController -->|injects via ContextModule| RequestContextPort
    TransactionHost__library_["TransactionHost (library)"]
    PrismaStorageObjectRepository -->|injects| TransactionHost__library_
    PrismaStorageObjectRepository -->|injects| TransactionHost__library_
    PrismaImportJobRepository -->|injects| TransactionHost__library_
    PrismaImportJobRepository -->|injects| TransactionHost__library_
    PrismaImportJobRowRepository -->|injects| TransactionHost__library_
    PrismaImportJobRowRepository -->|injects| TransactionHost__library_
    OutboxWriterPort["OutboxWriterPort"]
    PrismaImportJobOutboxWriter -->|injects via OutboxModule| OutboxWriterPort
    PrismaImportJobOutboxWriter -->|injects via OutboxModule| OutboxWriterPort
    Queue__library_["Queue (library)"]
    BullMqImportQueuePublisher -->|injects| Queue__library_
    ConfigService["ConfigService"]
    BullMqImportQueuePublisher -->|injects via ConfigModule| ConfigService
    BullMqImportQueuePublisher -->|injects| Queue__library_
    BullMqImportQueuePublisher -->|injects via ConfigModule| ConfigService
    BullMqImportWorker["BullMqImportWorker"]
    BullMqImportWorker -->|injects| ParseImportJobPort
    BullMqImportWorker -->|injects| ValidateImportJobPort
    BullMqImportWorker -->|injects| RunImportExecutionPort
    ImportReconciliationConsumer["ImportReconciliationConsumer"]
    ImportReconciliationConsumer -->|injects via ConfigModule| ConfigService
    ImportReconciliationConsumer -->|injects| ImportJobRepositoryPort
    ImportReconciliationConsumer -->|injects| ImportJobRowRepositoryPort
    ImportReconciliationConsumer -->|injects| ImportJobOutboxWriterPort
    InitImportUseCase -->|injects| ImportHandlerRegistry
    InitImportUseCase -->|injects| ImportJobRepositoryPort
    InitImportUseCase -->|injects| ImportHandlerRegistry
    InitImportUseCase -->|injects| ImportJobRepositoryPort
    CreateImportUploadUseCase -->|injects| ImportHandlerRegistry
    CreateImportUploadUseCase -->|injects via ConfigModule| ConfigService
    FileStoragePort["FileStoragePort"]
    CreateImportUploadUseCase -->|injects via StorageModule| FileStoragePort
    CreateImportUploadUseCase -->|injects| StorageObjectRepositoryPort
    CreateImportUploadUseCase -->|injects| ImportHandlerRegistry
    CreateImportUploadUseCase -->|injects via ConfigModule| ConfigService
    CreateImportUploadUseCase -->|injects via StorageModule| FileStoragePort
    CreateImportUploadUseCase -->|injects| StorageObjectRepositoryPort
    CreateImportJobUseCase -->|injects| ImportHandlerRegistry
    CreateImportJobUseCase -->|injects via ConfigModule| ConfigService
    CreateImportJobUseCase -->|injects via StorageModule| FileStoragePort
    NumberingPort["NumberingPort"]
    CreateImportJobUseCase -->|injects via NumberingModule| NumberingPort
    CreateImportJobUseCase -->|injects| StorageObjectRepositoryPort
    CreateImportJobUseCase -->|injects| ImportJobRepositoryPort
    CreateImportJobUseCase -->|injects| ImportQueuePublisherPort
    CreateImportJobUseCase -->|injects| ImportHandlerRegistry
    CreateImportJobUseCase -->|injects via ConfigModule| ConfigService
    CreateImportJobUseCase -->|injects via StorageModule| FileStoragePort
    CreateImportJobUseCase -->|injects via NumberingModule| NumberingPort
    CreateImportJobUseCase -->|injects| StorageObjectRepositoryPort
    CreateImportJobUseCase -->|injects| ImportJobRepositoryPort
    CreateImportJobUseCase -->|injects| ImportQueuePublisherPort
    GetImportPreviewUseCase -->|injects| ImportJobRepositoryPort
    GetImportPreviewUseCase -->|injects| ImportJobRowRepositoryPort
    GetImportPreviewUseCase -->|injects via ConfigModule| ConfigService
    GetImportPreviewUseCase -->|injects| ImportJobRepositoryPort
    GetImportPreviewUseCase -->|injects| ImportJobRowRepositoryPort
    GetImportPreviewUseCase -->|injects via ConfigModule| ConfigService
    UpdateImportMappingUseCase -->|injects| ImportJobRepositoryPort
    UpdateImportMappingUseCase -->|injects| ImportQueuePublisherPort
    UpdateImportMappingUseCase -->|injects| ImportJobRepositoryPort
    UpdateImportMappingUseCase -->|injects| ImportQueuePublisherPort
    GetImportReportUseCase -->|injects| ImportJobRepositoryPort
    GetImportReportUseCase -->|injects| ImportJobRowRepositoryPort
    GetImportReportUseCase -->|injects| ImportJobRepositoryPort
    GetImportReportUseCase -->|injects| ImportJobRowRepositoryPort
    ExecuteImportJobUseCase -->|injects| ImportJobRepositoryPort
    ExecuteImportJobUseCase -->|injects| ImportQueuePublisherPort
    ExecuteImportJobUseCase -->|injects| ImportJobRepositoryPort
    ExecuteImportJobUseCase -->|injects| ImportQueuePublisherPort
    CancelImportJobUseCase -->|injects| ImportJobRepositoryPort
    CancelImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    CancelImportJobUseCase -->|injects| ImportJobRepositoryPort
    CancelImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    GetImportJobStatusUseCase -->|injects| ImportJobRepositoryPort
    GetImportJobStatusUseCase -->|injects| ImportJobRepositoryPort
    ListImportJobsUseCase -->|injects| ImportJobRepositoryPort
    ListImportJobsUseCase -->|injects| ImportJobRepositoryPort
    ParseImportJobUseCase -->|injects via ConfigModule| ConfigService
    ParseImportJobUseCase -->|injects via StorageModule| FileStoragePort
    ParseImportJobUseCase -->|injects| ImportJobRepositoryPort
    ParseImportJobUseCase -->|injects| ImportJobRowRepositoryPort
    ParseImportJobUseCase -->|injects| StorageObjectRepositoryPort
    ParseImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    ParseImportJobUseCase -->|injects via ConfigModule| ConfigService
    ParseImportJobUseCase -->|injects via StorageModule| FileStoragePort
    ParseImportJobUseCase -->|injects| ImportJobRepositoryPort
    ParseImportJobUseCase -->|injects| ImportJobRowRepositoryPort
    ParseImportJobUseCase -->|injects| StorageObjectRepositoryPort
    ParseImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    ValidateImportJobUseCase -->|injects| ImportHandlerRegistry
    ValidateImportJobUseCase -->|injects via ConfigModule| ConfigService
    ValidateImportJobUseCase -->|injects| ImportJobRepositoryPort
    ValidateImportJobUseCase -->|injects| ImportJobRowRepositoryPort
    ValidateImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    ValidateImportJobUseCase -->|injects| ImportHandlerRegistry
    ValidateImportJobUseCase -->|injects via ConfigModule| ConfigService
    ValidateImportJobUseCase -->|injects| ImportJobRepositoryPort
    ValidateImportJobUseCase -->|injects| ImportJobRowRepositoryPort
    ValidateImportJobUseCase -->|injects| ImportJobOutboxWriterPort
    RunImportExecutionUseCase -->|injects| ImportHandlerRegistry
    RunImportExecutionUseCase -->|injects via ConfigModule| ConfigService
    RunImportExecutionUseCase -->|injects| ImportJobRepositoryPort
    RunImportExecutionUseCase -->|injects| ImportJobRowRepositoryPort
    RunImportExecutionUseCase -->|injects| ImportJobOutboxWriterPort
    RunImportExecutionUseCase -->|injects| ImportHandlerRegistry
    RunImportExecutionUseCase -->|injects via ConfigModule| ConfigService
    RunImportExecutionUseCase -->|injects| ImportJobRepositoryPort
    RunImportExecutionUseCase -->|injects| ImportJobRowRepositoryPort
    RunImportExecutionUseCase -->|injects| ImportJobOutboxWriterPort
```

#### RecurringModule — `src/platform/recurring/recurring.module.ts`

imports: ContextModule, OutboxModule, SchedulerModule, ConditionEngineModule · exports: RecurringGeneratorRegistry, RecurringExecutionPort, CreateRecurringTemplateUseCase

```mermaid
flowchart LR
    RecurringTemplateRepositoryPort["RecurringTemplateRepositoryPort"]
    PrismaRecurringTemplateRepository["PrismaRecurringTemplateRepository"]
    RecurringTemplateRepositoryPort -.->|useExisting| PrismaRecurringTemplateRepository
    RecurringExecutionRepositoryPort["RecurringExecutionRepositoryPort"]
    PrismaRecurringExecutionRepository["PrismaRecurringExecutionRepository"]
    RecurringExecutionRepositoryPort -.->|useExisting| PrismaRecurringExecutionRepository
    RecurringExecutionPort["RecurringExecutionPort"]
    RecurringExecutionFacade["RecurringExecutionFacade"]
    RecurringExecutionPort -.->|useExisting| RecurringExecutionFacade
    RecurringTemplateController["RecurringTemplateController"]
    CreateRecurringTemplateUseCase["CreateRecurringTemplateUseCase"]
    RecurringTemplateController -->|injects| CreateRecurringTemplateUseCase
    PauseRecurringTemplateUseCase["PauseRecurringTemplateUseCase"]
    RecurringTemplateController -->|injects| PauseRecurringTemplateUseCase
    ResumeRecurringTemplateUseCase["ResumeRecurringTemplateUseCase"]
    RecurringTemplateController -->|injects| ResumeRecurringTemplateUseCase
    CancelRecurringTemplateUseCase["CancelRecurringTemplateUseCase"]
    RecurringTemplateController -->|injects| CancelRecurringTemplateUseCase
    GetRecurringTemplateUseCase["GetRecurringTemplateUseCase"]
    RecurringTemplateController -->|injects| GetRecurringTemplateUseCase
    ListRecurringTemplatesUseCase["ListRecurringTemplatesUseCase"]
    RecurringTemplateController -->|injects| ListRecurringTemplatesUseCase
    RequestContextPort["RequestContextPort"]
    RecurringTemplateController -->|injects via ContextModule| RequestContextPort
    TransactionHost__library_["TransactionHost (library)"]
    PrismaRecurringTemplateRepository -->|injects| TransactionHost__library_
    PrismaRecurringTemplateRepository -->|injects| TransactionHost__library_
    PrismaRecurringExecutionRepository -->|injects| TransactionHost__library_
    PrismaRecurringExecutionRepository -->|injects| TransactionHost__library_
    RecurringGenerationHandler["RecurringGenerationHandler"]
    RecurringGenerationHandler -->|injects| RecurringTemplateRepositoryPort
    RecurringGenerationHandler -->|injects| RecurringExecutionRepositoryPort
    OutboxWriterPort["OutboxWriterPort"]
    RecurringGenerationHandler -->|injects via OutboxModule| OutboxWriterPort
    SchedulerPort["SchedulerPort"]
    RecurringGenerationHandler -->|injects via SchedulerModule| SchedulerPort
    ConditionEvaluator["ConditionEvaluator"]
    RecurringGenerationHandler -->|injects via ConditionEngineModule| ConditionEvaluator
    RecurringExecutionFacade -->|injects| RecurringExecutionRepositoryPort
    RecurringExecutionFacade -->|injects| RecurringExecutionRepositoryPort
    DomainEventDispatcher["DomainEventDispatcher"]
    EventEmitter2__library_["EventEmitter2 (library)"]
    DomainEventDispatcher -->|injects| EventEmitter2__library_
    DomainEventDispatcher -->|injects| RecurringTemplateRepositoryPort
    ScheduledJobHandlerRegistry["ScheduledJobHandlerRegistry"]
    DomainEventDispatcher -->|injects via SchedulerModule| ScheduledJobHandlerRegistry
    CreateRecurringTemplateUseCase -->|injects| RecurringTemplateRepositoryPort
    CreateRecurringTemplateUseCase -->|injects via SchedulerModule| SchedulerPort
    PauseRecurringTemplateUseCase -->|injects| RecurringTemplateRepositoryPort
    PauseRecurringTemplateUseCase -->|injects via SchedulerModule| SchedulerPort
    ResumeRecurringTemplateUseCase -->|injects| RecurringTemplateRepositoryPort
    ResumeRecurringTemplateUseCase -->|injects via SchedulerModule| SchedulerPort
    CancelRecurringTemplateUseCase -->|injects| RecurringTemplateRepositoryPort
    CancelRecurringTemplateUseCase -->|injects via SchedulerModule| SchedulerPort
    GetRecurringTemplateUseCase -->|injects| RecurringTemplateRepositoryPort
    ListRecurringTemplatesUseCase -->|injects| RecurringTemplateRepositoryPort
    RecurringModule_bootstrap["RecurringModule bootstrap"]
    RecurringModule_bootstrap -->|registers or injects| ScheduledJobHandlerRegistry
    RecurringModule_bootstrap -->|registers or injects| RecurringGenerationHandler
```

#### SchedulerModule — `src/platform/scheduler/scheduler.module.ts`

imports: MessagingModule, BullModule.registerQueue({ name: SCHEDULER_QUEUE_NAME }) · exports: SchedulerPort, RegisterScheduledJobPort, CancelScheduledJobPort, RescheduleExternalJobPort, UpdateScheduledJobPort, DispatchDueJobsPort, ReconcileMissedJobsPort, GetScheduledJobStatusPort, ListScheduledJobDispatchLogPort, GetSchedulerHealthMetricsPort, ScheduledJobHandlerRegistry

```mermaid
flowchart LR
    ScheduledJobRepositoryPort["ScheduledJobRepositoryPort"]
    PrismaScheduledJobRepository["PrismaScheduledJobRepository"]
    ScheduledJobRepositoryPort -.->|useExisting| PrismaScheduledJobRepository
    ScheduledJobDispatchLogRepositoryPort["ScheduledJobDispatchLogRepositoryPort"]
    PrismaScheduledJobDispatchLogRepository["PrismaScheduledJobDispatchLogRepository"]
    ScheduledJobDispatchLogRepositoryPort -.->|useExisting| PrismaScheduledJobDispatchLogRepository
    ScheduledJobEditLogRepositoryPort["ScheduledJobEditLogRepositoryPort"]
    PrismaScheduledJobEditLogRepository["PrismaScheduledJobEditLogRepository"]
    ScheduledJobEditLogRepositoryPort -.->|useExisting| PrismaScheduledJobEditLogRepository
    DistributedLockPort["DistributedLockPort"]
    RedisDistributedLockAdapter["RedisDistributedLockAdapter"]
    DistributedLockPort -.->|useExisting| RedisDistributedLockAdapter
    SchedulerEventPublisherPort["SchedulerEventPublisherPort"]
    RabbitMqSchedulerEventPublisher["RabbitMqSchedulerEventPublisher"]
    SchedulerEventPublisherPort -.->|useExisting| RabbitMqSchedulerEventPublisher
    SchedulerJobQueuePort["SchedulerJobQueuePort"]
    BullMqSchedulerJobQueue["BullMqSchedulerJobQueue"]
    SchedulerJobQueuePort -.->|useExisting| BullMqSchedulerJobQueue
    RegisterScheduledJobPort["RegisterScheduledJobPort"]
    RegisterScheduledJobUseCase["RegisterScheduledJobUseCase"]
    RegisterScheduledJobPort -.->|useExisting| RegisterScheduledJobUseCase
    CancelScheduledJobPort["CancelScheduledJobPort"]
    CancelScheduledJobUseCase["CancelScheduledJobUseCase"]
    CancelScheduledJobPort -.->|useExisting| CancelScheduledJobUseCase
    RescheduleExternalJobPort["RescheduleExternalJobPort"]
    RescheduleExternalJobUseCase["RescheduleExternalJobUseCase"]
    RescheduleExternalJobPort -.->|useExisting| RescheduleExternalJobUseCase
    UpdateScheduledJobPort["UpdateScheduledJobPort"]
    UpdateScheduledJobUseCase["UpdateScheduledJobUseCase"]
    UpdateScheduledJobPort -.->|useExisting| UpdateScheduledJobUseCase
    DispatchDueJobsPort["DispatchDueJobsPort"]
    DispatchDueJobsUseCase["DispatchDueJobsUseCase"]
    DispatchDueJobsPort -.->|useExisting| DispatchDueJobsUseCase
    ReconcileMissedJobsPort["ReconcileMissedJobsPort"]
    ReconcileMissedJobsUseCase["ReconcileMissedJobsUseCase"]
    ReconcileMissedJobsPort -.->|useExisting| ReconcileMissedJobsUseCase
    GetScheduledJobStatusPort["GetScheduledJobStatusPort"]
    GetScheduledJobStatusUseCase["GetScheduledJobStatusUseCase"]
    GetScheduledJobStatusPort -.->|useExisting| GetScheduledJobStatusUseCase
    ListScheduledJobDispatchLogPort["ListScheduledJobDispatchLogPort"]
    ListScheduledJobDispatchLogUseCase["ListScheduledJobDispatchLogUseCase"]
    ListScheduledJobDispatchLogPort -.->|useExisting| ListScheduledJobDispatchLogUseCase
    GetSchedulerHealthMetricsPort["GetSchedulerHealthMetricsPort"]
    GetSchedulerHealthMetricsUseCase["GetSchedulerHealthMetricsUseCase"]
    GetSchedulerHealthMetricsPort -.->|useExisting| GetSchedulerHealthMetricsUseCase
    SchedulerPort["SchedulerPort"]
    SchedulerPortFacade["SchedulerPortFacade"]
    SchedulerPort -.->|useExisting| SchedulerPortFacade
    SchedulerController["SchedulerController"]
    SchedulerController -->|injects| GetScheduledJobStatusPort
    SchedulerController -->|injects| ListScheduledJobDispatchLogPort
    SchedulerController -->|injects| UpdateScheduledJobPort
    SchedulerController -->|injects| CancelScheduledJobPort
    SchedulerHealthController["SchedulerHealthController"]
    SchedulerHealthController -->|injects| GetSchedulerHealthMetricsPort
    TransactionHost__library_["TransactionHost (library)"]
    PrismaScheduledJobRepository -->|injects| TransactionHost__library_
    ConfigService["ConfigService"]
    PrismaScheduledJobRepository -->|injects via ConfigModule| ConfigService
    PrismaScheduledJobRepository -->|injects| TransactionHost__library_
    PrismaScheduledJobRepository -->|injects via ConfigModule| ConfigService
    PrismaScheduledJobDispatchLogRepository -->|injects| TransactionHost__library_
    PrismaScheduledJobDispatchLogRepository -->|injects| TransactionHost__library_
    PrismaScheduledJobEditLogRepository -->|injects| TransactionHost__library_
    PrismaScheduledJobEditLogRepository -->|injects| TransactionHost__library_
    RedisService["RedisService"]
    RedisDistributedLockAdapter -->|injects via CacheModule| RedisService
    RedisDistributedLockAdapter -->|injects via CacheModule| RedisService
    RabbitMqPublisher["RabbitMqPublisher"]
    RabbitMqSchedulerEventPublisher -->|injects via MessagingModule| RabbitMqPublisher
    RabbitMqSchedulerEventPublisher -->|injects via MessagingModule| RabbitMqPublisher
    ScheduledJobProcessor["ScheduledJobProcessor"]
    ScheduledJobHandlerRegistry["ScheduledJobHandlerRegistry"]
    ScheduledJobProcessor -->|injects| ScheduledJobHandlerRegistry
    ScheduledJobProcessor -->|injects| SchedulerEventPublisherPort
    Queue__library_["Queue (library)"]
    BullMqSchedulerJobQueue -->|injects| Queue__library_
    BullMqSchedulerJobQueue -->|injects via ConfigModule| ConfigService
    BullMqSchedulerJobQueue -->|injects| Queue__library_
    BullMqSchedulerJobQueue -->|injects via ConfigModule| ConfigService
    BullMqSchedulerJobWorker["BullMqSchedulerJobWorker"]
    BullMqSchedulerJobWorker -->|injects| ScheduledJobProcessor
    BullMqSchedulerJobWorker -->|injects via ConfigModule| ConfigService
    BullMqSchedulerJobWorker -->|injects| ScheduledJobRepositoryPort
    BullMqSchedulerJobWorker -->|injects| ScheduledJobDispatchLogRepositoryPort
    RegisterScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    RegisterScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    CancelScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    CancelScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    RescheduleExternalJobUseCase -->|injects| ScheduledJobRepositoryPort
    RescheduleExternalJobUseCase -->|injects| ScheduledJobRepositoryPort
    UpdateScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    UpdateScheduledJobUseCase -->|injects| ScheduledJobEditLogRepositoryPort
    UpdateScheduledJobUseCase -->|injects| ScheduledJobRepositoryPort
    UpdateScheduledJobUseCase -->|injects| ScheduledJobEditLogRepositoryPort
    DispatchDueJobsUseCase -->|injects| ScheduledJobRepositoryPort
    DispatchDueJobsUseCase -->|injects| DistributedLockPort
    DispatchDueJobsUseCase -->|injects| SchedulerJobQueuePort
    DispatchDueJobsUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    DispatchDueJobsUseCase -->|injects via ConfigModule| ConfigService
    DispatchDueJobsUseCase -->|injects| ScheduledJobRepositoryPort
    DispatchDueJobsUseCase -->|injects| DistributedLockPort
    DispatchDueJobsUseCase -->|injects| SchedulerJobQueuePort
    DispatchDueJobsUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    DispatchDueJobsUseCase -->|injects via ConfigModule| ConfigService
    ReconcileMissedJobsUseCase -->|injects| ScheduledJobRepositoryPort
    ReconcileMissedJobsUseCase -->|injects| DistributedLockPort
    ReconcileMissedJobsUseCase -->|injects| ScheduledJobRepositoryPort
    ReconcileMissedJobsUseCase -->|injects| DistributedLockPort
    GetScheduledJobStatusUseCase -->|injects| ScheduledJobRepositoryPort
    GetScheduledJobStatusUseCase -->|injects| ScheduledJobRepositoryPort
    ListScheduledJobDispatchLogUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    ListScheduledJobDispatchLogUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    GetSchedulerHealthMetricsUseCase -->|injects| ScheduledJobRepositoryPort
    GetSchedulerHealthMetricsUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    GetSchedulerHealthMetricsUseCase -->|injects| ScheduledJobRepositoryPort
    GetSchedulerHealthMetricsUseCase -->|injects| ScheduledJobDispatchLogRepositoryPort
    SchedulerPortFacade -->|injects| RegisterScheduledJobPort
    SchedulerPortFacade -->|injects| CancelScheduledJobPort
    SchedulerPortFacade -->|injects| RescheduleExternalJobPort
    SchedulerPortFacade -->|injects| RegisterScheduledJobPort
    SchedulerPortFacade -->|injects| CancelScheduledJobPort
    SchedulerPortFacade -->|injects| RescheduleExternalJobPort
    SchedulerTicker["SchedulerTicker"]
    SchedulerTicker -->|injects| DispatchDueJobsPort
    SchedulerTicker -->|injects| ReconcileMissedJobsPort
    SchedulerTicker -->|injects via ConfigModule| ConfigService
    SchedulerRegistry__library_["SchedulerRegistry (library)"]
    SchedulerTicker -->|injects| SchedulerRegistry__library_
```

### Composition-only modules

#### AppModule — `src/app.module.ts`

imports: ConfigModule, InfrastructureModule, PlatformModule, BusinessModule · exports: —

```mermaid
flowchart LR
    APP_INTERCEPTOR["APP_INTERCEPTOR"]
    ResponseInterceptor["ResponseInterceptor"]
    APP_INTERCEPTOR -.->|useClass| ResponseInterceptor
    APP_FILTER["APP_FILTER"]
    HttpExceptionsFilter["HttpExceptionsFilter"]
    APP_FILTER -.->|useClass| HttpExceptionsFilter
    APP_PIPE["APP_PIPE"]
    AppValidationPipe["AppValidationPipe"]
    APP_PIPE -.->|useClass| AppValidationPipe
    RequestIdInterceptor["RequestIdInterceptor"]
    APP_INTERCEPTOR -.->|useClass| RequestIdInterceptor
    LoggingInterceptor["LoggingInterceptor"]
    APP_INTERCEPTOR -.->|useClass| LoggingInterceptor
    DeviceResponseInterceptor["DeviceResponseInterceptor"]
    APP_INTERCEPTOR -.->|useClass| DeviceResponseInterceptor
    ClsService__library_["ClsService (library)"]
    RequestIdInterceptor -->|injects| ClsService__library_
    LoggingInterceptor -->|injects| ClsService__library_
    DeviceResponseInterceptor -->|injects| ClsService__library_
```

#### BusinessModule — `src/business/business.module.ts`

imports: PartyModule, ProcurementModule, SalesModule · exports: —

_Composition only._

#### PartyModule — `src/business/party/party.module.ts`

imports: VendorModule · exports: —

_Composition only._

#### ProcurementModule — `src/business/procurement/procurement.module.ts`

imports: ProductModule, PurchaseOrderModule, GoodReceiptNoteModule · exports: —

_Composition only._

#### SalesModule — `src/business/sales/sales.module.ts`

imports: InvoiceModule · exports: —

_Composition only._

> Companion: [`docs/FLOWCHARTS.md`](FLOWCHARTS.md) — the runtime flows these wires power.
> `TransactionHost` = CLS-backed transactional Prisma client (write side);
> `PrismaReadPort` is bound in `DatabaseModule` to `PrismaReadService` (read replica).

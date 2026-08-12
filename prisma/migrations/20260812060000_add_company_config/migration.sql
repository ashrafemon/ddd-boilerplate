-- CreateTable
CREATE TABLE "company_configs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "autoApproveThreshold" DECIMAL(18, 2) NOT NULL DEFAULT 10000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_configs_companyId_key" ON "company_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_configs_companyCode_key" ON "company_configs"("companyCode");
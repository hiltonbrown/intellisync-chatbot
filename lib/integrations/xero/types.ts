/**
 * Xero API Type Definitions
 * Based on Xero API v2.0 specification
 */

export interface XeroContact {
	ContactID?: string;
	ContactNumber?: string;
	AccountNumber?: string;
	ContactStatus?: "ACTIVE" | "ARCHIVED" | "GDPRREQUEST";
	Name: string;
	FirstName?: string;
	LastName?: string;
	EmailAddress?: string;
	SkypeUserName?: string;
	ContactPersons?: XeroContactPerson[];
	BankAccountDetails?: string;
	TaxNumber?: string;
	AccountsReceivableTaxType?: string;
	AccountsPayableTaxType?: string;
	Addresses?: XeroAddress[];
	Phones?: XeroPhone[];
	IsSupplier?: boolean;
	IsCustomer?: boolean;
	DefaultCurrency?: string;
	UpdatedDateUTC?: string;
	ContactGroups?: XeroContactGroup[];
}

export interface XeroContactPerson {
	FirstName?: string;
	LastName?: string;
	EmailAddress?: string;
	IncludeInEmails?: boolean;
}

export interface XeroAddress {
	AddressType: "POBOX" | "STREET" | "DELIVERY";
	AddressLine1?: string;
	AddressLine2?: string;
	AddressLine3?: string;
	AddressLine4?: string;
	City?: string;
	Region?: string;
	PostalCode?: string;
	Country?: string;
	AttentionTo?: string;
}

export interface XeroPhone {
	PhoneType: "DEFAULT" | "DDI" | "MOBILE" | "FAX";
	PhoneNumber?: string;
	PhoneAreaCode?: string;
	PhoneCountryCode?: string;
}

export interface XeroContactGroup {
	ContactGroupID?: string;
	Name?: string;
	Status?: string;
}

export interface XeroInvoice {
	InvoiceID?: string;
	InvoiceNumber?: string;
	Type: "ACCREC" | "ACCPAY";
	Contact: XeroContact | { ContactID: string };
	LineItems: XeroLineItem[];
	Date?: string;
	DueDate?: string;
	LineAmountTypes?: "Exclusive" | "Inclusive" | "NoTax";
	Reference?: string;
	BrandingThemeID?: string;
	Url?: string;
	CurrencyCode?: string;
	CurrencyRate?: number;
	Status?:
		| "DRAFT"
		| "SUBMITTED"
		| "DELETED"
		| "AUTHORISED"
		| "PAID"
		| "VOIDED";
	SentToContact?: boolean;
	ExpectedPaymentDate?: string;
	PlannedPaymentDate?: string;
	SubTotal?: number;
	TotalTax?: number;
	Total?: number;
	TotalDiscount?: number;
	AmountDue?: number;
	AmountPaid?: number;
	AmountCredited?: number;
	UpdatedDateUTC?: string;
	Payments?: XeroPayment[];
}

export interface XeroLineItem {
	LineItemID?: string;
	Description: string;
	Quantity?: number;
	UnitAmount?: number;
	ItemCode?: string;
	AccountCode?: string;
	TaxType?: string;
	TaxAmount?: number;
	LineAmount?: number;
	DiscountRate?: number;
	DiscountAmount?: number;
	Tracking?: XeroTracking[];
}

export interface XeroTracking {
	TrackingCategoryID?: string;
	TrackingOptionID?: string;
	Name?: string;
	Option?: string;
}

export interface XeroPayment {
	PaymentID?: string;
	Date: string;
	Amount: number;
	Reference?: string;
	CurrencyRate?: number;
	PaymentType?: "ACCRECPAYMENT" | "ACCPAYPAYMENT" | "ARCREDITPAYMENT";
	Status?: "AUTHORISED" | "DELETED";
	UpdatedDateUTC?: string;
	Invoice?: { InvoiceID: string };
	Account?: { AccountID: string; Code?: string };
}

export interface XeroAccount {
	AccountID?: string;
	Code: string;
	Name: string;
	Type?:
		| "BANK"
		| "CURRENT"
		| "CURRLIAB"
		| "DEPRECIATN"
		| "DIRECTCOSTS"
		| "EQUITY"
		| "EXPENSE"
		| "FIXED"
		| "INVENTORY"
		| "LIABILITY"
		| "NONCURRENT"
		| "OTHERINCOME"
		| "OVERHEADS"
		| "PREPAYMENT"
		| "REVENUE"
		| "SALES"
		| "TERMLIAB"
		| "PAYGLIABILITY"
		| "SUPERANNUATIONEXPENSE"
		| "SUPERANNUATIONLIABILITY"
		| "WAGESEXPENSE"
		| "WAGESPAYABLELIABILITY";
	TaxType?: string;
	Description?: string;
	Class?:
		| "ASSET"
		| "EQUITY"
		| "EXPENSE"
		| "LIABILITY"
		| "REVENUE";
	Status?: "ACTIVE" | "ARCHIVED" | "DELETED";
	SystemAccount?: string;
	EnablePaymentsToAccount?: boolean;
	ShowInExpenseClaims?: boolean;
	BankAccountNumber?: string;
	BankAccountType?:
		| "BANK"
		| "CREDITCARD"
		| "PAYPAL"
		| "NONE"
		| "LOANLIABILITY";
	CurrencyCode?: string;
	ReportingCode?: string;
	ReportingCodeName?: string;
	HasAttachments?: boolean;
	UpdatedDateUTC?: string;
}

export interface XeroQuote {
	QuoteID?: string;
	QuoteNumber?: string;
	Reference?: string;
	Terms?: string;
	Contact: XeroContact | { ContactID: string };
	LineItems: XeroLineItem[];
	Date?: string;
	DateString?: string;
	ExpiryDate?: string;
	ExpiryDateString?: string;
	Status?: "DRAFT" | "SENT" | "DECLINED" | "ACCEPTED" | "INVOICED" | "DELETED";
	LineAmountTypes?: "Exclusive" | "Inclusive" | "NoTax";
	SubTotal?: number;
	TotalTax?: number;
	Total?: number;
	UpdatedDateUTC?: string;
	CurrencyCode?: string;
	Title?: string;
	Summary?: string;
	BrandingThemeID?: string;
}

export interface XeroCreditNote {
	CreditNoteID?: string;
	CreditNoteNumber?: string;
	Type: "ACCRECCREDIT" | "ACCPAYCREDIT";
	Contact: XeroContact | { ContactID: string };
	LineItems: XeroLineItem[];
	Date?: string;
	Status?: "DRAFT" | "SUBMITTED" | "DELETED" | "AUTHORISED" | "PAID" | "VOIDED";
	LineAmountTypes?: "Exclusive" | "Inclusive" | "NoTax";
	SubTotal?: number;
	TotalTax?: number;
	Total?: number;
	UpdatedDateUTC?: string;
	CurrencyCode?: string;
	FullyPaidOnDate?: string;
	Reference?: string;
	SentToContact?: boolean;
	RemainingCredit?: number;
	Allocations?: XeroAllocation[];
	BrandingThemeID?: string;
}

export interface XeroAllocation {
	AllocationID?: string;
	Invoice: { InvoiceID: string };
	AppliedAmount: number;
	Date: string;
}

export interface XeroTaxRate {
	Name?: string;
	TaxType?: string;
	CanApplyToAssets?: boolean;
	CanApplyToEquity?: boolean;
	CanApplyToExpenses?: boolean;
	CanApplyToLiabilities?: boolean;
	CanApplyToRevenue?: boolean;
	DisplayTaxRate?: number;
	EffectiveRate?: number;
	Status?: "ACTIVE" | "DELETED" | "ARCHIVED";
}

export interface XeroEmployee {
	EmployeeID?: string;
	Status?: "ACTIVE" | "DELETED";
	FirstName: string;
	LastName: string;
	ExternalLink?: {
		Url?: string;
		Description?: string;
	};
	UpdatedDateUTC?: string;
}

export interface XeroTimesheet {
	TimesheetID?: string;
	EmployeeID: string;
	StartDate: string;
	EndDate: string;
	Status?: "DRAFT" | "PROCESSED" | "APPROVED";
	Hours?: number;
	TimesheetLines?: XeroTimesheetLine[];
	UpdatedDateUTC?: string;
}

export interface XeroTimesheetLine {
	TimesheetLineID?: string;
	Date?: string;
	EarningsRateID?: string;
	TrackingItemID?: string;
	NumberOfUnits?: number[];
	UpdatedDateUTC?: string;
}

export interface XeroLeaveApplication {
	LeaveApplicationID?: string;
	EmployeeID: string;
	LeaveTypeID: string;
	Title: string;
	StartDate: string;
	EndDate: string;
	Description?: string;
	LeavePeriods?: XeroLeavePeriod[];
	UpdatedDateUTC?: string;
}

export interface XeroLeavePeriod {
	NumberOfUnits?: number;
	LeavePeriodStatus?: "SCHEDULED" | "PROCESSED";
}

export interface XeroReportProfitLoss {
	ReportID?: string;
	ReportName?: string;
	ReportType?: string;
	ReportTitles?: string[];
	ReportDate?: string;
	UpdatedDateUTC?: string;
	Rows?: XeroReportRow[];
}

export interface XeroReportBalanceSheet {
	ReportID?: string;
	ReportName?: string;
	ReportType?: string;
	ReportTitles?: string[];
	ReportDate?: string;
	UpdatedDateUTC?: string;
	Rows?: XeroReportRow[];
}

export interface XeroReportTrialBalance {
	ReportID?: string;
	ReportName?: string;
	ReportType?: string;
	ReportTitles?: string[];
	ReportDate?: string;
	UpdatedDateUTC?: string;
	Rows?: XeroReportRow[];
}

export interface XeroReportAgedReceivables {
	ReportID?: string;
	ReportName?: string;
	ReportType?: string;
	ReportTitles?: string[];
	ReportDate?: string;
	UpdatedDateUTC?: string;
	Rows?: XeroReportRow[];
}

export interface XeroReportRow {
	RowType?: "Header" | "Section" | "Row" | "SummaryRow";
	Title?: string;
	Cells?: XeroReportCell[];
	Rows?: XeroReportRow[];
}

export interface XeroReportCell {
	Value?: string;
	Attributes?: Array<{ Value?: string; Id?: string }>;
}

/**
 * Common filter options for list operations
 */
export interface XeroListOptions {
	page?: number;
	where?: string;
	order?: string;
	includeArchived?: boolean;
	offset?: number;
}

/**
 * Standard Xero API response wrapper
 */
export interface XeroApiResponse<T> {
	Id?: string;
	Status?: string;
	ProviderName?: string;
	DateTimeUTC?: string;
	[key: string]: T[] | string | undefined;
}

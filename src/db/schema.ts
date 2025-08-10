import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  jsonb,
  decimal,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const scrapeSessions = pgTable('scrape_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  source: text('source').notNull(),
  searchUrl: text('search_url').notNull().default('https://app.apollo.io/'),
  timestamp: timestamp('timestamp')
    .notNull()
    .$defaultFn(() => new Date()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  isApifyEnriched: boolean('is_apify_enriched')
    .$defaultFn(() => false)
    .notNull(),
});

export const leads = pgTable('leads', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  jobTitle: text('job_title'),
  company: text('company'),
  email: text('email'),
  emailStatus: text('email_status').default('unchecked'),
  phone: text('phone'),
  linkedInUrl: text('linkedin_url'),
  location: text('location'),
  employees: text('employees'),
  industries: text('industries'),
  companyWebsite: text('company_website'),
  companyDomain: text('company_domain'),
  companyLinkedIn: text('company_linkedin'),
  companyFacebook: text('company_facebook'),
  companyTwitter: text('company_twitter'),
  source: text('source').notNull().default('apollo'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  scrapeSessionId: text('scrape_session_id')
    .references(() => scrapeSessions.id, { onDelete: 'cascade' })
    .notNull(),
  isApifyEnriched: boolean('is_apify_enriched').default(false),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const linkedin_profiles = pgTable('linkedin_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name').notNull(),
  apifyEmail: text('apify_email'),
  mobileNumber: text('mobile_number'),
  jobTitle: text('job_title'),
  linkedinUrl: text('linkedin_url'),
  source: text('source').notNull().default('apify'),
  leadId: text('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

// Email enrichments table for TryKitt.ai integration
export const email_enrichments = pgTable('email_enrichments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  leadId: text('lead_id')
    .notNull()
    .unique()
    .references(() => leads.id, { onDelete: 'cascade' }),
  email: text('email'),
  validIdentity: boolean('valid_identity'),
  validSmtp: boolean('valid_smtp'),
  mxDomain: text('mx_domain'),
  jobId: text('job_id'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const linkedin_experiences = pgTable('linkedin_experiences', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id')
    .notNull()
    .references(() => linkedin_profiles.id, { onDelete: 'cascade' }),
  companyId: text('company_id'),
  companyName: text('company_name'),
  companyLogo: text('company_logo'),
  title: text('title').notNull(),
  caption: text('caption'),
  dateRange: text('date_range'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const linkedin_educations = pgTable('linkedin_educations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id')
    .notNull()
    .references(() => linkedin_profiles.id, { onDelete: 'cascade' }),
  institutionName: text('institution_name').notNull(),
  logo: text('logo'),
  caption: text('caption'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const linkedin_company_details = pgTable('linkedin_company_details', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id')
    .notNull()
    .references(() => linkedin_profiles.id, { onDelete: 'cascade' }),
  companyName: text('company_name'),
  companyIndustry: text('company_industry'),
  companyWebsite: text('company_website'),
  companyLinkedin: text('company_linkedin'),
  companyFoundedIn: integer('company_founded_in'),
  companySize: text('company_size'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const linkedin_profile_details = pgTable('linkedin_profile_details', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id')
    .notNull()
    .references(() => linkedin_profiles.id, { onDelete: 'cascade' }),
  headline: text('headline'),
  connections: integer('connections'),
  followers: integer('followers'),
  addressCountry: text('address_country'),
  addressFull: text('address_full'),
  profilePic: text('profile_pic'),
  about: text('about'),
  publicIdentifier: text('public_identifier'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const user_api_keys = pgTable('user_api_keys', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  iv: text('iv').notNull(), // Initialization vector for AES-GCM
  tag: text('tag').notNull(), // Authentication tag for AES-GCM
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

// Plans table - stores subscription plan details from Lemon Squeezy
export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: text('price').notNull(),
  interval: text('interval'),
  intervalCount: integer('intervalCount'),
  isUsageBased: boolean('isUsageBased').default(false),
  productId: integer('productId').notNull(),
  productName: text('productName'),
  variantId: integer('variantId').unique().notNull(),
  trialInterval: text('trialInterval'),
  trialIntervalCount: integer('trialIntervalCount'),
  sort: integer('sort'),
  creditAmount: integer('creditAmount'), // nullable; >0 only for single-payment packs
});

// Subscriptions table - stores user subscription details
export const subscriptions = pgTable('subscription', {
  id: serial('id').primaryKey(),
  lemonSqueezyId: text('lemonSqueezyId').unique().notNull(),
  orderId: integer('orderId').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  status: text('status').notNull(),
  statusFormatted: text('statusFormatted').notNull(),
  renewsAt: text('renewsAt'),
  endsAt: text('endsAt'),
  trialEndsAt: text('trialEndsAt'),
  price: text('price').notNull(),
  isUsageBased: boolean('isUsageBased').default(false),
  isPaused: boolean('isPaused').default(false),
  subscriptionItemId: serial('subscriptionItemId'),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  planId: integer('planId')
    .notNull()
    .references(() => plans.id),
});

// User credits table - stores user credit balance
export const user_credits = pgTable('user_credits', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Credit transactions table - stores credit transaction history
export const credit_transactions = pgTable('credit_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // purchase | spend | manual | refund
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // positive or negative with 2 decimal places
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

// Lists table - stores CSV import lists
export const lists = pgTable('lists', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  jobId: text('job_id').unique(),
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// List columns table - stores column metadata for lists
export const listColumns = pgTable('list_columns', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  listId: text('list_id')
    .notNull()
    .references(() => lists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Display name from CSV header
  key: text('key').notNull(), // Stable database key (slugified)
  type: text('type').notNull(), // 'string' | 'jsonb'
  order: integer('order').notNull(), // Column order for display
  config: jsonb('config'), // Additional column configuration
});

// List rows table - stores the actual data rows
export const listRows = pgTable('list_rows', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  listId: text('list_id')
    .notNull()
    .references(() => lists.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(), // JSON object with column keys -> values
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  leads,
  scrapeSessions,
  linkedin_profiles,
  linkedin_experiences,
  linkedin_educations,
  linkedin_company_details,
  linkedin_profile_details,
  user_api_keys,
  plans,
  subscriptions,
  user_credits,
  credit_transactions,
  lists,
  listColumns,
  listRows,
};

// Export inferred types for better type safety
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UserCredit = typeof user_credits.$inferSelect;
export type NewUserCredit = typeof user_credits.$inferInsert;
export type CreditTransaction = typeof credit_transactions.$inferSelect;
export type NewCreditTransaction = typeof credit_transactions.$inferInsert;
export type List = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;
export type ListColumn = typeof listColumns.$inferSelect;
export type NewListColumn = typeof listColumns.$inferInsert;
export type ListRow = typeof listRows.$inferSelect;
export type NewListRow = typeof listRows.$inferInsert;

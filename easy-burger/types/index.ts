/** Clés de la table `settings` (§7). Aucune règle métier n'est en dur. */
export type SettingKey =
  | 'points_per_mad'
  | 'redemption_rate'
  | 'points_expiry_months'
  | 'welcome_reward_enabled'
  | 'welcome_min_order_cents'
  | 'birthday_reward_product_id'
  | 'delivery_fee_cents'
  | 'free_delivery_threshold_cents'
  | 'min_order_cents'
  | 'opening_hours'
  | 'is_accepting_orders'
  | 'cashier_daily_points_cap'

export type OrderChannel = 'app' | 'counter' | 'glovo'
export type OrderMode = 'delivery' | 'pickup'

/** Déclinaisons du logo livrées dans /public/logo (§4.0). */
export type LogoVariant =
  | 'noir'
  | 'blanc'
  | 'orange'
  | 'noir-orange'
  | 'blanc-orange'

export type BrandInk = 'noir' | 'blanc' | 'orange' | 'cream'

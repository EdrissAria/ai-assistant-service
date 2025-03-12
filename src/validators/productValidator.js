import vine from "@vinejs/vine";

export const insertSchema = vine.object({
  vendor: vine.string(),
  platform: vine.enum(["shopify", "woocommerce", "custom"]),
  products: vine.array(
    vine.object({
      id: vine.string(),
      title: vine.string(),
      description: vine.string().nullable(),
      category: vine.string().optional(),
      price: vine.string().regex(/^\d+(\.\d{1,2})?$/),
      inventory: vine.number().min(0),
      tags: vine.string().optional(),
      image_url: vine.string().url().nullable().optional(),
    })
  ),
});

export const updateSchema = vine.object({
  vendor: vine.string(),
  platform: vine.enum(["shopify", "woocommerce", "custom"]),
  product: vine.object({
    id: vine.string(),
    title: vine.string().optional(),
    description: vine.string().nullable().optional(),
    category: vine.string().optional(),
    price: vine
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    inventory: vine.number().min(0).optional(),
    tags: vine.string().optional(),
    image_url: vine.string().url().nullable().optional(),
  }),
});

export const deleteSchema = vine.object({
  vendor: vine.string(),
  platform: vine.enum(["shopify", "woocommerce", "custom"]),
  id: vine.string(),
});

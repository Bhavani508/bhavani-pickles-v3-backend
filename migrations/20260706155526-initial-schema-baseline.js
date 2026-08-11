/**
 * Initial schema baseline migration.
 *
 * This captures the existing schema state so future migrations
 * have a known starting point. It creates indexes that the
 * application relies on but Mongoose auto-index might miss
 * in production (where autoIndex is typically disabled).
 */
module.exports = {
  async up(db) {
    // Ensure users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // Ensure products collection indexes (text search)
    await db
      .collection('products')
      .createIndex(
        { name: 'text', description: 'text', tags: 'text' },
        { name: 'products_text_search' },
      );

    // Ensure product variants compound index
    await db
      .collection('productvariants')
      .createIndex({ product: 1, weight: 1 });

    // Ensure cart user index
    await db.collection('carts').createIndex({ user: 1 }, { unique: true });

    // Ensure orders indexes
    await db.collection('orders').createIndex({ user: 1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });

    // Ensure categories name uniqueness
    await db
      .collection('categories')
      .createIndex({ name: 1 }, { unique: true });
  },

  async down(db) {
    await db.collection('users').dropIndex({ email: 1 });
    await db.collection('products').dropIndex('products_text_search');
    await db.collection('productvariants').dropIndex({ product: 1, weight: 1 });
    await db.collection('carts').dropIndex({ user: 1 });
    await db.collection('orders').dropIndex({ user: 1 });
    await db.collection('orders').dropIndex({ status: 1 });
    await db.collection('orders').dropIndex({ createdAt: -1 });
    await db.collection('categories').dropIndex({ name: 1 });
  },
};

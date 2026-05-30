import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `npx prisma db seed` runs this. The script is idempotent so it's
    // safe after `migrate reset` or after the DB already has the rows
    // inserted by the floor-item migration.
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})

import { libsql } from "./client"

await libsql.execute(`ALTER TABLE settings ADD COLUMN logoPublicId TEXT`)

console.log("Cloudinary migration complete.")

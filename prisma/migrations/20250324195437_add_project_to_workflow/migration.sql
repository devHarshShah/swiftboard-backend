-- CreateMigration

-- Get a project ID that exists in the database
DO $$
DECLARE
  first_project_id TEXT;
BEGIN
  -- Fetch the first project's ID
  SELECT id INTO first_project_id FROM "Project" LIMIT 1;
  
  IF first_project_id IS NULL THEN
    -- If no projects exist, create one
    INSERT INTO "Project" (id, name, description, "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'Default Project', 'Created during migration', NOW(), NOW())
    RETURNING id INTO first_project_id;
  END IF;

  -- Now add the column with a default value referring to the project
  ALTER TABLE "WorkFlow" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
  
  -- Update existing records to use the first project
  UPDATE "WorkFlow" SET "projectId" = first_project_id WHERE "projectId" IS NULL OR "projectId" = '';
  
  -- Now make the column NOT NULL after all records have a value
  ALTER TABLE "WorkFlow" ALTER COLUMN "projectId" SET NOT NULL;
  
  -- Add the foreign key constraint
  ALTER TABLE "WorkFlow" ADD CONSTRAINT IF NOT EXISTS "WorkFlow_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
  
  -- Add unique constraint if needed
  ALTER TABLE "WorkFlow" ADD CONSTRAINT IF NOT EXISTS "WorkFlow_projectId_key" UNIQUE ("projectId");
END $$;
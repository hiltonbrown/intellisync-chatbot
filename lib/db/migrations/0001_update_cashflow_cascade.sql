-- Update cashflow_adjustments foreign key to use CASCADE delete
ALTER TABLE "cashflow_adjustments" DROP CONSTRAINT "cashflow_adjustments_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "cashflow_adjustments" ADD CONSTRAINT "cashflow_adjustments_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;

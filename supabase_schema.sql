


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Insert a profile row only if it doesn't already exist.
  insert into public.profiles (
    id,
    email,
    role,
    status,
    created_at,
    updated_at
  )
  select
    new.id,
    new.email,
    'worker'::text,
    'active'::text,
    now(),
    now()
  where not exists (
    select 1
    from public.profiles p
    where p.id = new.id
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversations_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."company_information" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "company_code" "text",
    "industry" "text",
    "website" "text",
    "email" "text",
    "phone" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "address" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_information" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "serial_number" "text",
    "status" "text" DEFAULT 'available'::"text",
    "location" "text",
    "assigned_to" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "last_service_date" "date",
    "next_service_date" "date",
    "condition" "text",
    "purchase_date" "date"
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender" "text",
    "content" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "role" "text",
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message" "text",
    "read_status" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'worker'::"text",
    "avatar_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "department" "text",
    "employee_id" "text",
    "email" "text",
    "position" "text",
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "bio" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'worker'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "risk_level" "text",
    "risk_score" numeric,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."risk_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safety_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "status" "text" DEFAULT 'open'::"text",
    "severity" "text",
    "worker_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."safety_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "created_by" "uuid",
    "assigned_to" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "ticket_number" "text",
    "assigned_admin" "uuid",
    "category" "text",
    "worker_id" "uuid",
    "department" "text",
    "conversation_id" "uuid"
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "position" "text",
    "department" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "employee_number" "text",
    "employment_type" "text" DEFAULT 'Permanent'::"text",
    "shift_type" "text" DEFAULT 'Day'::"text",
    "hire_date" "date",
    "location" "text",
    "availability" "text" DEFAULT 'available'::"text"
);


ALTER TABLE "public"."workers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workforce" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "employee_number" "text",
    "employment_type" "text",
    "shift_type" "text",
    "location" "text",
    "availability" "text" DEFAULT 'available'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."workforce" OWNER TO "postgres";


ALTER TABLE ONLY "public"."company_information"
    ADD CONSTRAINT "company_information_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_employee_id_unique" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_history"
    ADD CONSTRAINT "risk_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_incidents"
    ADD CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_number_key" UNIQUE ("ticket_number");



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workforce"
    ADD CONSTRAINT "workforce_employee_number_key" UNIQUE ("employee_number");



ALTER TABLE ONLY "public"."workforce"
    ADD CONSTRAINT "workforce_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_equipment_assigned" ON "public"."equipment" USING "btree" ("assigned_to");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_tickets_created_by" ON "public"."tickets" USING "btree" ("created_by");



CREATE INDEX "idx_workers_department" ON "public"."workers" USING "btree" ("department");



CREATE INDEX "idx_workers_employee_number" ON "public"."workers" USING "btree" ("employee_number");



CREATE INDEX "idx_workers_position" ON "public"."workers" USING "btree" ("position");



CREATE INDEX "idx_workers_search" ON "public"."workers" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((COALESCE("full_name", ''::"text") || ' '::"text") || COALESCE("position", ''::"text")) || ' '::"text") || COALESCE("department", ''::"text"))));



CREATE INDEX "idx_workers_status" ON "public"."workers" USING "btree" ("status");



CREATE INDEX "tickets_conversation_id_idx" ON "public"."tickets" USING "btree" ("conversation_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."workers"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."workers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."workforce"
    ADD CONSTRAINT "workforce_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow chatbot conversation access" ON "public"."conversations" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users view workers" ON "public"."workers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create tickets" ON "public"."tickets" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view equipment" ON "public"."equipment" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view messages" ON "public"."messages" FOR SELECT USING (true);



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view tickets" ON "public"."tickets" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view workers" ON "public"."workers" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Workers can submit incidents" ON "public"."safety_incidents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "worker_id"));



CREATE POLICY "Workers can view incidents" ON "public"."safety_incidents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "worker_id"));



CREATE POLICY "allow all select tickets" ON "public"."tickets" FOR SELECT USING (true);



CREATE POLICY "allow insert risk_history" ON "public"."risk_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow insert tickets" ON "public"."tickets" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow read risk_history" ON "public"."risk_history" FOR SELECT USING (true);



CREATE POLICY "allow update tickets" ON "public"."tickets" FOR UPDATE USING (true);



ALTER TABLE "public"."company_information" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_all" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "profiles_update_all" ON "public"."profiles" FOR UPDATE USING (true);



ALTER TABLE "public"."risk_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."safety_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workforce" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."company_information" TO "anon";
GRANT ALL ON TABLE "public"."company_information" TO "authenticated";
GRANT ALL ON TABLE "public"."company_information" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."risk_history" TO "anon";
GRANT ALL ON TABLE "public"."risk_history" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_history" TO "service_role";



GRANT ALL ON TABLE "public"."safety_incidents" TO "anon";
GRANT ALL ON TABLE "public"."safety_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."workers" TO "anon";
GRANT ALL ON TABLE "public"."workers" TO "authenticated";
GRANT ALL ON TABLE "public"."workers" TO "service_role";



GRANT ALL ON TABLE "public"."workforce" TO "anon";
GRANT ALL ON TABLE "public"."workforce" TO "authenticated";
GRANT ALL ON TABLE "public"."workforce" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








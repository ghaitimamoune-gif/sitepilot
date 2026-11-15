CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"poste_id" integer NOT NULL,
	"jeton_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilisee_le" timestamp with time zone,
	"utilisee_par_personne_id" integer,
	"annulee_le" timestamp with time zone,
	"cree_par_poste_id" integer,
	"cree_par_personne_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_jeton_idx" ON "invitations" USING btree ("jeton_hash");
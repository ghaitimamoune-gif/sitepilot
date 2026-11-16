CREATE TABLE "retours" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" text NOT NULL,
	"texte" text NOT NULL,
	"poste_id" integer,
	"personne_id" integer,
	"traite" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);

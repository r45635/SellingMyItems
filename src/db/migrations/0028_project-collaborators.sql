CREATE TABLE project_collaborators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seller_account_id UUID NOT NULL REFERENCES seller_accounts(id) ON DELETE CASCADE,
  invited_by        UUID REFERENCES seller_accounts(id),
  invited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, seller_account_id)
);

CREATE INDEX ON project_collaborators(project_id);
CREATE INDEX ON project_collaborators(seller_account_id);

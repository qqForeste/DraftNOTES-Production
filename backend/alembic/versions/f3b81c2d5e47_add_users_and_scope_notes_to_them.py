"""add users and scope notes to them

Revision ID: f3b81c2d5e47
Revises: c41d7b0e9a52
Create Date: 2026-08-24
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f3b81c2d5e47"
down_revision: Union[str, Sequence[str], None] = "c41d7b0e9a52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("oauth_sub", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("display_name", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "oauth_sub", name="uq_app_user_provider_sub"),
    )
    op.create_table(
        "user_summoner",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("puuid", sa.String(length=78), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["puuid"], ["summoner.puuid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "puuid"),
    )

    op.add_column("note", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))

    # legacy user per noted summoner
    op.execute(
        """
        INSERT INTO app_user (id, provider, oauth_sub, display_name)
        SELECT gen_random_uuid(), 'legacy', 'legacy:' || s.puuid, s.game_name
        FROM summoner s
        WHERE EXISTS (SELECT 1 FROM note n WHERE n.puuid = s.puuid)
        """
    )
    op.execute(
        """
        INSERT INTO user_summoner (user_id, puuid, is_primary)
        SELECT u.id, substring(u.oauth_sub from 8), true
        FROM app_user u
        WHERE u.provider = 'legacy'
        """
    )
    op.execute(
        """
        UPDATE note n
        SET user_id = us.user_id
        FROM user_summoner us
        WHERE us.puuid = n.puuid
        """
    )
    op.execute("DELETE FROM note WHERE user_id IS NULL")
    op.alter_column("note", "user_id", nullable=False)

    op.create_foreign_key(
        "fk_note_user_id", "note", "app_user", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint("uq_note_match_puuid", "note", type_="unique")
    op.create_unique_constraint(
        "uq_note_user_match_puuid", "note", ["user_id", "match_id", "puuid"]
    )


def downgrade() -> None:
    # drops extra users' notes
    op.execute(
        """
        DELETE FROM note a
        USING note b
        WHERE a.match_id = b.match_id AND a.puuid = b.puuid AND a.id > b.id
        """
    )
    op.drop_constraint("uq_note_user_match_puuid", "note", type_="unique")
    op.create_unique_constraint("uq_note_match_puuid", "note", ["match_id", "puuid"])
    op.drop_constraint("fk_note_user_id", "note", type_="foreignkey")
    op.drop_column("note", "user_id")
    op.drop_table("user_summoner")
    op.drop_table("app_user")

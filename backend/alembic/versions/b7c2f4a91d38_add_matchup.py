"""add the matchup table

Revision ID: b7c2f4a91d38
Revises: ee1a4c9d3b70
Create Date: 2026-08-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "b7c2f4a91d38"
down_revision: Union[str, Sequence[str], None] = "ee1a4c9d3b70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLES = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")


def upgrade() -> None:
    op.create_table(
        "matchup",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=8), nullable=False),
        sa.Column("your_champion_id", sa.Integer(), nullable=False),
        sa.Column("enemy_champion_id", sa.Integer(), nullable=False),
        sa.Column("tags", sa.ARRAY(sa.String(length=32)), nullable=False),
        sa.Column("weaknesses", sa.ARRAY(sa.String(length=32)), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("loadout", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "role",
            "your_champion_id",
            "enemy_champion_id",
            name="uq_matchup_user_role_pair",
        ),
        sa.CheckConstraint(
            "role IN ({})".format(", ".join(f"'{r}'" for r in ROLES)),
            name="ck_matchup_role",
        ),
    )
    op.create_index("ix_matchup_user_id", "matchup", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_matchup_user_id", table_name="matchup")
    op.drop_table("matchup")

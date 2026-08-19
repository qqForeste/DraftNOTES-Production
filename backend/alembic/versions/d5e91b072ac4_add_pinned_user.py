"""add the pinned_user table

Revision ID: d5e91b072ac4
Revises: c8d3a15e027f
Create Date: 2026-08-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "d5e91b072ac4"
down_revision: Union[str, Sequence[str], None] = "c8d3a15e027f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pinned_user",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("puuid", sa.String(length=78), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["puuid"], ["summoner.puuid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "puuid", name="uq_pinned_user_user_puuid"),
    )
    op.create_index("ix_pinned_user_user_created", "pinned_user", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_pinned_user_user_created", table_name="pinned_user")
    op.drop_table("pinned_user")

"""scoreboard detail columns, rank cache timestamp and rank history

Revision ID: c8d3a15e027f
Revises: b7c2f4a91d38
Create Date: 2026-08-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d3a15e027f"
down_revision: Union[str, Sequence[str], None] = "b7c2f4a91d38"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("match", sa.Column("winning_team_id", sa.Integer(), nullable=True))
    op.add_column("participant", sa.Column("role_quest_item_id", sa.Integer(), nullable=True))
    op.add_column(
        "summoner", sa.Column("rank_checked_at", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "rank_snapshot",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("puuid", sa.String(length=78), nullable=False),
        sa.Column("queue", sa.String(length=8), nullable=False),
        sa.Column("tier", sa.String(length=16), nullable=True),
        sa.Column("division", sa.String(length=4), nullable=True),
        sa.Column("lp", sa.Integer(), nullable=True),
        sa.Column("wins", sa.Integer(), nullable=True),
        sa.Column("losses", sa.Integer(), nullable=True),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["puuid"], ["summoner.puuid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_rank_snapshot_puuid_queue_captured",
        "rank_snapshot",
        ["puuid", "queue", "captured_at"],
    )

    # Seed one point per queue from the rank we already hold, so an existing
    # user's LP chart is not empty until their second sync.
    for queue in ("solo", "flex"):
        op.execute(
            f"""
            INSERT INTO rank_snapshot (puuid, queue, tier, division, lp, wins, losses, captured_at)
            SELECT puuid, '{queue}', {queue}_tier, {queue}_division, {queue}_lp,
                   {queue}_wins, {queue}_losses, COALESCE(last_synced_at, now())
            FROM summoner
            WHERE {queue}_tier IS NOT NULL
            """
        )


def downgrade() -> None:
    op.drop_index("ix_rank_snapshot_puuid_queue_captured", table_name="rank_snapshot")
    op.drop_table("rank_snapshot")
    op.drop_column("summoner", "rank_checked_at")
    op.drop_column("participant", "role_quest_item_id")
    op.drop_column("match", "winning_team_id")

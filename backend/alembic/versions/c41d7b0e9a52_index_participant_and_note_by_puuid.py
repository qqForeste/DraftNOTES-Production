"""index participant and note by puuid

Revision ID: c41d7b0e9a52
Revises: 6a2ae938076f
Create Date: 2026-08-24
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "c41d7b0e9a52"
down_revision: Union[str, Sequence[str], None] = "6a2ae938076f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_participant_puuid", "participant", ["puuid"])
    op.create_index("ix_note_puuid", "note", ["puuid"])
    op.drop_index("ix_participant_champion_id", table_name="participant")


def downgrade() -> None:
    op.create_index("ix_participant_champion_id", "participant", ["champion_id"])
    op.drop_index("ix_note_puuid", table_name="note")
    op.drop_index("ix_participant_puuid", table_name="participant")

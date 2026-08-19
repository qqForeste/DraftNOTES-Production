"""consolidate the mistake tag taxonomy from ten tags to eight

Revision ID: ee1a4c9d3b70
Revises: f3b81c2d5e47
Create Date: 2026-08-28
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "ee1a4c9d3b70"
down_revision: Union[str, Sequence[str], None] = "f3b81c2d5e47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_VALUES = (
    "died_to_gank",
    "overextended",
    "missed_wave",
    "bad_recall_timing",
    "bad_teamfight",
    "tilted",
    "mechanical_misplay",
    "no_map_awareness",
)

OLD_VALUES = (
    "died_to_gank",
    "overextended_no_vision",
    "missed_wave",
    "bad_recall_timing",
    "forced_fight_no_summs",
    "poor_objective_setup",
    "tilted_after_death",
    "wrong_item_build",
    "misplayed_teamfight_position",
    "no_map_awareness",
)

# Three renames plus three retirements. Both fights and objectives fold into
# tags that already existed, so no note loses its meaning entirely.
REMAP = {
    "overextended_no_vision": "overextended",
    "tilted_after_death": "tilted",
    "misplayed_teamfight_position": "bad_teamfight",
    "forced_fight_no_summs": "bad_teamfight",
    "poor_objective_setup": "no_map_awareness",
    "wrong_item_build": "mechanical_misplay",
}

# Best-effort inverse for a downgrade. The retirements are many-to-one, so the
# three tags that had no pre-change identity of their own map back to whichever
# old tag was closest; a downgrade cannot restore what a note originally said.
UNMAP = {
    "overextended": "overextended_no_vision",
    "tilted": "tilted_after_death",
    "bad_teamfight": "misplayed_teamfight_position",
    "mechanical_misplay": "wrong_item_build",
}


def _case(mapping: dict[str, str], column: str) -> str:
    whens = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items())
    return f"CASE {column}::text {whens} ELSE {column}::text END"


def _swap_enum(values: Sequence[str], mapping: dict[str, str]) -> None:
    joined = ", ".join(f"'{v}'" for v in values)
    op.execute(f"CREATE TYPE mistake_tag_new AS ENUM ({joined})")
    op.execute(
        "ALTER TABLE note_tag ALTER COLUMN tag_key TYPE mistake_tag_new "
        f"USING ({_case(mapping, 'tag_key')})::mistake_tag_new"
    )
    op.execute("DROP TYPE mistake_tag")
    op.execute("ALTER TYPE mistake_tag_new RENAME TO mistake_tag")


def _collapse_collisions(mapping: dict[str, str]) -> None:
    """Drop rows that the remap would turn into a duplicate primary key.

    note_tag's PK is (note_id, tag_key), and the remap is many-to-one: a note
    tagged both forced_fight_no_summs and misplayed_teamfight_position ends up
    with two bad_teamfight rows. Keep the row with the lowest phase/rowid so the
    choice is deterministic, and delete the rest before the type swap, which
    would otherwise fail on the primary key.
    """
    whens = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items())
    op.execute(
        f"""
        DELETE FROM note_tag t
        USING (
            SELECT note_id, tag_key,
                   row_number() OVER (
                       PARTITION BY note_id,
                           CASE tag_key::text {whens} ELSE tag_key::text END
                       ORDER BY phase, tag_key::text
                   ) AS rn
            FROM note_tag
        ) d
        WHERE t.note_id = d.note_id AND t.tag_key = d.tag_key AND d.rn > 1
        """
    )


def upgrade() -> None:
    _collapse_collisions(REMAP)
    _swap_enum(NEW_VALUES, REMAP)


def downgrade() -> None:
    _collapse_collisions(UNMAP)
    _swap_enum(OLD_VALUES, UNMAP)

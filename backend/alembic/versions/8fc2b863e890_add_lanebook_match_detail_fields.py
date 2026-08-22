"""add lanebook match detail fields

Revision ID: 8fc2b863e890
Revises: d9502123f707
Create Date: 2026-08-24 11:38:25.527470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8fc2b863e890'
down_revision: Union[str, Sequence[str], None] = 'd9502123f707'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('match', sa.Column('scoreboard', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('participant', sa.Column('items', postgresql.ARRAY(sa.Integer()), nullable=True))
    op.add_column('participant', sa.Column('summoner_1_id', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('summoner_2_id', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('primary_rune_id', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('secondary_style_id', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('champion_level', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('double_kills', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('triple_kills', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('quadra_kills', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('penta_kills', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('wards_placed', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('control_wards_purchased', sa.Integer(), nullable=True))
    op.add_column('participant', sa.Column('kill_participation_pct', sa.Float(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('participant', 'kill_participation_pct')
    op.drop_column('participant', 'control_wards_purchased')
    op.drop_column('participant', 'wards_placed')
    op.drop_column('participant', 'penta_kills')
    op.drop_column('participant', 'quadra_kills')
    op.drop_column('participant', 'triple_kills')
    op.drop_column('participant', 'double_kills')
    op.drop_column('participant', 'champion_level')
    op.drop_column('participant', 'secondary_style_id')
    op.drop_column('participant', 'primary_rune_id')
    op.drop_column('participant', 'summoner_2_id')
    op.drop_column('participant', 'summoner_1_id')
    op.drop_column('participant', 'items')
    op.drop_column('match', 'scoreboard')
    # ### end Alembic commands ###

"""add summoner platform and ranked stats

Revision ID: 6a2ae938076f
Revises: a8f3e51477d0
Create Date: 2026-08-24 12:49:04.551118

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a2ae938076f'
down_revision: Union[str, Sequence[str], None] = 'a8f3e51477d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('summoner', sa.Column('platform', sa.String(length=8), nullable=True))
    op.add_column('summoner', sa.Column('solo_tier', sa.String(length=16), nullable=True))
    op.add_column('summoner', sa.Column('solo_division', sa.String(length=4), nullable=True))
    op.add_column('summoner', sa.Column('solo_lp', sa.Integer(), nullable=True))
    op.add_column('summoner', sa.Column('solo_wins', sa.Integer(), nullable=True))
    op.add_column('summoner', sa.Column('solo_losses', sa.Integer(), nullable=True))
    op.add_column('summoner', sa.Column('flex_tier', sa.String(length=16), nullable=True))
    op.add_column('summoner', sa.Column('flex_division', sa.String(length=4), nullable=True))
    op.add_column('summoner', sa.Column('flex_lp', sa.Integer(), nullable=True))
    op.add_column('summoner', sa.Column('flex_wins', sa.Integer(), nullable=True))
    op.add_column('summoner', sa.Column('flex_losses', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('summoner', 'flex_losses')
    op.drop_column('summoner', 'flex_wins')
    op.drop_column('summoner', 'flex_lp')
    op.drop_column('summoner', 'flex_division')
    op.drop_column('summoner', 'flex_tier')
    op.drop_column('summoner', 'solo_losses')
    op.drop_column('summoner', 'solo_wins')
    op.drop_column('summoner', 'solo_lp')
    op.drop_column('summoner', 'solo_division')
    op.drop_column('summoner', 'solo_tier')
    op.drop_column('summoner', 'platform')
    # ### end Alembic commands ###

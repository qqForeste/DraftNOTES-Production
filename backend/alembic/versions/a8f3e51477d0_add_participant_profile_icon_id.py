"""add participant profile icon id

Revision ID: a8f3e51477d0
Revises: 8fc2b863e890
Create Date: 2026-08-24 12:10:20.229581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f3e51477d0'
down_revision: Union[str, Sequence[str], None] = '8fc2b863e890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('participant', sa.Column('profile_icon_id', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('participant', 'profile_icon_id')
    # ### end Alembic commands ###

"""initial schema: summoner, match, participant, note, note_tag

Revision ID: d9502123f707
Revises: 
Create Date: 2026-08-23 16:25:13.644781

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9502123f707'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('match',
    sa.Column('match_id', sa.String(length=24), nullable=False),
    sa.Column('game_creation', sa.DateTime(timezone=True), nullable=False),
    sa.Column('game_duration', sa.Integer(), nullable=False),
    sa.Column('queue_id', sa.Integer(), nullable=False),
    sa.Column('patch', sa.String(length=16), nullable=False),
    sa.PrimaryKeyConstraint('match_id')
    )
    op.create_index('ix_match_game_creation', 'match', ['game_creation'], unique=False)
    op.create_table('summoner',
    sa.Column('puuid', sa.String(length=78), nullable=False),
    sa.Column('game_name', sa.String(length=64), nullable=False),
    sa.Column('tag_line', sa.String(length=16), nullable=False),
    sa.Column('region', sa.String(length=16), nullable=False),
    sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('puuid')
    )
    op.create_table('participant',
    sa.Column('match_id', sa.String(length=24), nullable=False),
    sa.Column('puuid', sa.String(length=78), nullable=False),
    sa.Column('champion_id', sa.Integer(), nullable=False),
    sa.Column('team_position', sa.String(length=16), nullable=True),
    sa.Column('win', sa.Boolean(), nullable=False),
    sa.Column('kills', sa.Integer(), nullable=False),
    sa.Column('deaths', sa.Integer(), nullable=False),
    sa.Column('assists', sa.Integer(), nullable=False),
    sa.Column('cs', sa.Integer(), nullable=False),
    sa.Column('gold_earned', sa.Integer(), nullable=False),
    sa.Column('cs_at_14', sa.Integer(), nullable=True),
    sa.Column('gold_diff_at_14', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['match_id'], ['match.match_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['puuid'], ['summoner.puuid'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('match_id', 'puuid')
    )
    op.create_index('ix_participant_champion_id', 'participant', ['champion_id'], unique=False)
    op.create_table('note',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('match_id', sa.String(length=24), nullable=False),
    sa.Column('puuid', sa.String(length=78), nullable=False),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['match_id', 'puuid'], ['participant.match_id', 'participant.puuid'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('match_id', 'puuid', name='uq_note_match_puuid')
    )
    op.create_table('note_tag',
    sa.Column('note_id', sa.Integer(), nullable=False),
    sa.Column('tag_key', sa.Enum('died_to_gank', 'overextended_no_vision', 'missed_wave', 'bad_recall_timing', 'forced_fight_no_summs', 'poor_objective_setup', 'tilted_after_death', 'wrong_item_build', 'misplayed_teamfight_position', 'no_map_awareness', name='mistake_tag'), nullable=False),
    sa.Column('phase', sa.Enum('early', 'mid', 'late', name='game_phase'), nullable=False),
    sa.Column('timestamp_seconds', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['note_id'], ['note.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('note_id', 'tag_key')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('note_tag')
    op.drop_table('note')
    op.drop_index('ix_participant_champion_id', table_name='participant')
    op.drop_table('participant')
    op.drop_table('summoner')
    op.drop_index('ix_match_game_creation', table_name='match')
    op.drop_table('match')
    # ### end Alembic commands ###

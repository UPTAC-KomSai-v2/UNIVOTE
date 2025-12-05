import uuid
import random
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta
from api.models import (
    User, Election, Position, CandidateProfile, 
    VoterProfile, CandidateForPosition, Vote, VoteReceipt,
    CandidateUpdate, TallyResult, AuditLog, LoginAttempt,
    NetworkLog, RequestLog, SystemMetric
)

class Command(BaseCommand):
    help = 'Seeds the database with consistent test data for all tables'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Cleaning old data...'))
        
        # 1. CLEANUP (Child tables first to avoid ForeignKey errors)
        VoteReceipt.objects.all().delete()
        Vote.objects.all().delete()
        CandidateForPosition.objects.all().delete()
        CandidateUpdate.objects.all().delete()
        TallyResult.objects.all().delete()
        AuditLog.objects.all().delete()
        LoginAttempt.objects.all().delete()
        NetworkLog.objects.all().delete()
        RequestLog.objects.all().delete()
        SystemMetric.objects.all().delete()
        
        CandidateProfile.objects.all().delete()
        VoterProfile.objects.all().delete()
        User.objects.all().delete()
        Position.objects.all().delete()
        Election.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('Old data cleaned.'))

        # ==========================================
        # 2. ELECTION & POSITIONS
        # ==========================================
        election = Election.objects.create(
            title="2025 University Student Council",
            description="General Elections for the Academic Year 2025-2026",
            start_datetime=timezone.now() - timedelta(days=1), # Started yesterday
            end_datetime=timezone.now() + timedelta(days=7),   # Ends in a week
            is_active=True
        )

        pos_chair = Position.objects.create(election=election, name="Chairperson", max_winners=1, choice_type='single')
        pos_vice = Position.objects.create(election=election, name="Vice Chairperson", max_winners=1, choice_type='single')
        pos_coun = Position.objects.create(election=election, name="Councilor", max_winners=7, choice_type='multiple')

        # ==========================================
        # 3. USERS (ADMIN)
        # ==========================================
        User.objects.create(
            email="admin@up.edu.ph",
            name="Super Admin",
            password=make_password("admin123"),
            role="admin"
        )

        # ==========================================
        # 4. CANDIDATES
        # ==========================================
        # Format: (Email, Name, Party, Alias, PositionObj)
        cand_data = [
            ("chair1@up.edu.ph", "Juan Dela Cruz", "Sandigan", "Kapitan", pos_chair),
            ("chair2@up.edu.ph", "Maria Clara", "Maharlika", "Madam", pos_chair),
            ("vice1@up.edu.ph", "Antonio Luna", "Sandigan", "Heneral", pos_vice),
            ("vice2@up.edu.ph", "Apolinario Mabini", "Maharlika", "Dakila", pos_vice),
            
            # Councilors (Mixed parties)
            ("coun1@up.edu.ph", "Jose Rizal", "Sandigan", "Pepe", pos_coun),
            ("coun2@up.edu.ph", "Andres Bonifacio", "Maharlika", "Supremo", pos_coun),
            ("coun3@up.edu.ph", "Emilio Aguinaldo", "Independent", "Miong", pos_coun),
            ("coun4@up.edu.ph", "Gabriela Silang", "Sandigan", "Ella", pos_coun),
            ("coun5@up.edu.ph", "Melchora Aquino", "Maharlika", "Tandang Sora", pos_coun),
            ("coun6@up.edu.ph", "Marcelo H. Del Pilar", "Sandigan", "Plaridel", pos_coun),
            ("coun7@up.edu.ph", "Juan Luna", "Independent", "Spoliarium", pos_coun),
            ("coun8@up.edu.ph", "Graciano Lopez Jaena", "Maharlika", "Orator", pos_coun),
        ]

        cand_profiles = {} # Store for later voting use

        for email, name, party, alias, pos in cand_data:
            u = User.objects.create(
                email=email, name=name, password=make_password("password123"), role="candidate"
            )
            cp = CandidateProfile.objects.create(
                email=u, party=party, alias=alias, bio=f"Vote for {alias}!", is_verified=True
            )
            CandidateForPosition.objects.create(position=pos, candidate_email=cp)
            
            # Create a dummy update
            CandidateUpdate.objects.create(
                candidate_email=cp, content=f"Campaign update from {alias}: Rally at AS Steps!", is_approved=True
            )
            
            cand_profiles[email] = cp # Cache for voting logic below

        self.stdout.write(self.style.SUCCESS(f'Created {len(cand_data)} Candidates'))

        # ==========================================
        # 5. VOTERS (Some pre-voted, some fresh)
        # ==========================================
        # Voter 1 & 2: Will have already voted
        # Voter 3, 4, 5: Will be fresh for YOU to test
        
        for i in range(1, 6):
            email = f"voter{i}@up.edu.ph"
            u = User.objects.create(
                email=email, name=f"Voter {i}", password=make_password("password123"), role="voter"
            )
            vp = VoterProfile.objects.create(
                email=u, student_number=f"2023-{10000+i}", course="BS CS", year_level=3
            )

            # SIMULATE VOTES FOR VOTER 1 & 2
            if i <= 2:
                # Vote for Chair 1, Vice 1, and first 3 councilors
                votes_to_cast = [
                    (pos_chair, cand_profiles["chair1@up.edu.ph"]),
                    (pos_vice, cand_profiles["vice1@up.edu.ph"]),
                    (pos_coun, cand_profiles["coun1@up.edu.ph"]),
                    (pos_coun, cand_profiles["coun2@up.edu.ph"]),
                    (pos_coun, cand_profiles["coun3@up.edu.ph"]),
                ]

                for position, candidate in votes_to_cast:
                    v = Vote.objects.create(
                        election=election,
                        voter_email=u,
                        position=position,
                        candidate_email=candidate,
                        encrypted_vote="encrypted_hash_dummy",
                        idempotency_key=str(uuid.uuid4())
                    )
                    # Create Receipt
                    VoteReceipt.objects.create(
                        vote=v,
                        ack_hash=str(uuid.uuid4()),
                        client_timestamp=timezone.now(),
                        retransmissions=0
                    )

        self.stdout.write(self.style.SUCCESS('Created 5 Voters (2 have already voted)'))

        # ==========================================
        # 6. LOGS & METRICS (For Admin Dashboard)
        # ==========================================
        admin_user = User.objects.get(email="admin@up.edu.ph")
        
        AuditLog.objects.create(
            user_email=admin_user, action="Initial System Seed", 
            ip_address="127.0.0.1", prev_hash="0000", curr_hash="1234"
        )
        
        LoginAttempt.objects.create(
            user_email=admin_user, ip_address="192.168.1.5", status="SUCCESS"
        )
        
        NetworkLog.objects.create(
            user_email=admin_user, ip_address="127.0.0.1", latency_ms=45, 
            packet_loss=0.0, event_type="Ping Check"
        )

        SystemMetric.objects.create(metric_name="CPU Usage", metric_value=12.5)
        SystemMetric.objects.create(metric_name="Memory Usage", metric_value=45.2)

        self.stdout.write(self.style.SUCCESS('Created Logs and Metrics'))
        self.stdout.write(self.style.SUCCESS('--------------------------------------'))
        self.stdout.write(self.style.SUCCESS('SEEDING COMPLETE!'))
        self.stdout.write(self.style.SUCCESS('--------------------------------------'))
        self.stdout.write(self.style.SUCCESS('Admin Login: admin@up.edu.ph / admin123'))
        self.stdout.write(self.style.SUCCESS('Voter Login: voter1@up.edu.ph / password123 (Has Voted)'))
        self.stdout.write(self.style.SUCCESS('Voter Login: voter3@up.edu.ph / password123 (Fresh)'))
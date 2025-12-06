import uuid
import random
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta, datetime
from api.models import (
    User, Election, Position, CandidateProfile, 
    VoterProfile, CandidateForPosition, Vote, VoteReceipt,
    CandidateUpdate, TallyResult, AuditLog, LoginAttempt,
    NetworkLog, RequestLog, SystemMetric
)

class Command(BaseCommand):
    help = 'Seeds the database with historical test data for 2023, 2024, and 2025 elections'

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
        # 2. CREATE ADMIN USER
        # ==========================================
        admin_user = User.objects.create(
            email="admin@up.edu.ph",
            name="Super Admin",
            password=make_password("admin123"),
            role="admin"
        )

        # ==========================================
        # 3. CREATE HISTORICAL ELECTIONS
        # ==========================================
        
        # === 2023 ELECTION (Completed) ===
        election_2023 = Election.objects.create(
            title="2023 University Student Council",
            description="General Elections for the Academic Year 2023-2024",
            start_datetime=datetime(2023, 3, 1, 8, 0, 0),
            end_datetime=datetime(2023, 3, 7, 18, 0, 0),
            is_active=False
        )

        pos_2023_chair = Position.objects.create(election=election_2023, name="Chairperson", max_winners=1, choice_type='single')
        pos_2023_vice = Position.objects.create(election=election_2023, name="Vice Chairperson", max_winners=1, choice_type='single')
        pos_2023_coun = Position.objects.create(election=election_2023, name="Councilor", max_winners=5, choice_type='multiple')

        # === 2024 ELECTION (Completed) ===
        election_2024 = Election.objects.create(
            title="2024 University Student Council",
            description="General Elections for the Academic Year 2024-2025",
            start_datetime=datetime(2024, 3, 1, 8, 0, 0),
            end_datetime=datetime(2024, 3, 7, 18, 0, 0),
            is_active=False
        )

        pos_2024_chair = Position.objects.create(election=election_2024, name="Chairperson", max_winners=1, choice_type='single')
        pos_2024_vice = Position.objects.create(election=election_2024, name="Vice Chairperson", max_winners=1, choice_type='single')
        pos_2024_coun = Position.objects.create(election=election_2024, name="Councilor", max_winners=6, choice_type='multiple')

        # === 2025 ELECTION (Active) ===
        election_2025 = Election.objects.create(
            title="2025 University Student Council",
            description="General Elections for the Academic Year 2025-2026",
            start_datetime=timezone.now() - timedelta(days=1),
            end_datetime=timezone.now() + timedelta(days=7),
            is_active=True
        )

        pos_2025_chair = Position.objects.create(election=election_2025, name="Chairperson", max_winners=1, choice_type='single')
        pos_2025_vice = Position.objects.create(election=election_2025, name="Vice Chairperson", max_winners=1, choice_type='single')
        pos_2025_coun = Position.objects.create(election=election_2025, name="Councilor", max_winners=7, choice_type='multiple')

        # ==========================================
        # 4. CREATE CANDIDATES FOR 2023
        # ==========================================
        cand_2023_data = [
            # Chairperson
            ("maria.santos2023@up.edu.ph", "Maria Santos", "Progresibo", "Ria", pos_2023_chair),
            ("pedro.reyes2023@up.edu.ph", "Pedro Reyes", "Alyansa", "Pete", pos_2023_chair),
            
            # Vice Chairperson
            ("luz.fernandez2023@up.edu.ph", "Luz Fernandez", "Progresibo", "Lucy", pos_2023_vice),
            ("ramon.cruz2023@up.edu.ph", "Ramon Cruz", "Alyansa", "Mon", pos_2023_vice),
            
            # Councilors
            ("juan.garcia2023@up.edu.ph", "Juan Garcia", "Progresibo", "Juancho", pos_2023_coun),
            ("elena.lopez2023@up.edu.ph", "Elena Lopez", "Alyansa", "Lenny", pos_2023_coun),
            ("miguel.ramos2023@up.edu.ph", "Miguel Ramos", "Independent", "Mike", pos_2023_coun),
            ("isabel.mendoza2023@up.edu.ph", "Isabel Mendoza", "Progresibo", "Bella", pos_2023_coun),
            ("rafael.castillo2023@up.edu.ph", "Rafael Castillo", "Alyansa", "Raffy", pos_2023_coun),
            ("carmen.santos2023@up.edu.ph", "Carmen Santos", "Progresibo", "Carmy", pos_2023_coun),
            ("antonio.flores2023@up.edu.ph", "Antonio Flores", "Independent", "Tony", pos_2023_coun),
            ("rosa.martinez2023@up.edu.ph", "Rosa Martinez", "Alyansa", "Rose", pos_2023_coun),
        ]

        self._create_candidates(cand_2023_data, "2023")

        # ==========================================
        # 5. CREATE CANDIDATES FOR 2024
        # ==========================================
        cand_2024_data = [
            # Chairperson
            ("sofia.domingo2024@up.edu.ph", "Sofia Domingo", "Sandigan", "Sof", pos_2024_chair),
            ("gabriel.villanueva2024@up.edu.ph", "Gabriel Villanueva", "Kapatiran", "Gab", pos_2024_chair),
            
            # Vice Chairperson
            ("victoria.aquino2024@up.edu.ph", "Victoria Aquino", "Sandigan", "Vicky", pos_2024_vice),
            ("lorenzo.bautista2024@up.edu.ph", "Lorenzo Bautista", "Kapatiran", "Enzo", pos_2024_vice),
            
            # Councilors
            ("daniela.cruz2024@up.edu.ph", "Daniela Cruz", "Sandigan", "Dani", pos_2024_coun),
            ("sebastian.ramirez2024@up.edu.ph", "Sebastian Ramirez", "Kapatiran", "Seb", pos_2024_coun),
            ("valentina.torres2024@up.edu.ph", "Valentina Torres", "Independent", "Val", pos_2024_coun),
            ("nicolas.silva2024@up.edu.ph", "Nicolas Silva", "Sandigan", "Nico", pos_2024_coun),
            ("camila.mendez2024@up.edu.ph", "Camila Mendez", "Kapatiran", "Mila", pos_2024_coun),
            ("lucas.jimenez2024@up.edu.ph", "Lucas Jimenez", "Sandigan", "Luke", pos_2024_coun),
            ("martina.gutierrez2024@up.edu.ph", "Martina Gutierrez", "Independent", "Tina", pos_2024_coun),
            ("diego.castro2024@up.edu.ph", "Diego Castro", "Kapatiran", "Diex", pos_2024_coun),
            ("ana.torres2024@up.edu.ph", "Ana Torres", "Sandigan", "Annie", pos_2024_coun),
        ]

        self._create_candidates(cand_2024_data, "2024")

        # ==========================================
        # 6. CREATE CANDIDATES FOR 2025
        # ==========================================
        cand_2025_data = [
            # Chairperson
            ("chair1@up.edu.ph", "Juan Dela Cruz", "Sandigan", "Kapitan", pos_2025_chair),
            ("chair2@up.edu.ph", "Maria Clara", "Maharlika", "Madam", pos_2025_chair),
            
            # Vice Chairperson
            ("vice1@up.edu.ph", "Antonio Luna", "Sandigan", "Heneral", pos_2025_vice),
            ("vice2@up.edu.ph", "Apolinario Mabini", "Maharlika", "Dakila", pos_2025_vice),
            
            # Councilors
            ("coun1@up.edu.ph", "Jose Rizal", "Sandigan", "Pepe", pos_2025_coun),
            ("coun2@up.edu.ph", "Andres Bonifacio", "Maharlika", "Supremo", pos_2025_coun),
            ("coun3@up.edu.ph", "Emilio Aguinaldo", "Independent", "Miong", pos_2025_coun),
            ("coun4@up.edu.ph", "Gabriela Silang", "Sandigan", "Ella", pos_2025_coun),
            ("coun5@up.edu.ph", "Melchora Aquino", "Maharlika", "Tandang Sora", pos_2025_coun),
            ("coun6@up.edu.ph", "Marcelo H. Del Pilar", "Sandigan", "Plaridel", pos_2025_coun),
            ("coun7@up.edu.ph", "Juan Luna", "Independent", "Spoliarium", pos_2025_coun),
            ("coun8@up.edu.ph", "Graciano Lopez Jaena", "Maharlika", "Orator", pos_2025_coun),
            ("coun9@up.edu.ph", "Josefa Llanes Escoda", "Sandigan", "Pepa", pos_2025_coun),
            ("coun10@up.edu.ph", "Fernando Ma. Guerrero", "Maharlika", "Fer", pos_2025_coun),
        ]

        cand_2025_profiles = self._create_candidates(cand_2025_data, "2025", return_profiles=True)

        # ==========================================
        # 7. CREATE VOTERS & SIMULATE VOTES
        # ==========================================
        
        # Create 20 voters for historical data
        voters = []
        for i in range(1, 21):
            email = f"voter{i}@up.edu.ph"
            u = User.objects.create(
                email=email,
                name=f"Voter {i}",
                password=make_password("password123"),
                role="voter"
            )
            vp = VoterProfile.objects.create(
                email=u,
                student_number=f"2023-{10000+i}",
                course=random.choice(["BS Accountancy", 
                                    "BS Applied Mathematics", 
                                    "BS Biology", 
                                    "BS Computer Science", 
                                    "BS Economics",
                                    "BA Literature",
                                    "BS Management", 
                                    "BA Media Arts",
                                    "BA Political Science",
                                    "BA Psychology"
                                    ]),
                year_level=random.randint(1, 4)
            )
            voters.append(u)

        # Simulate votes for 2023 (15 voters)
        self._simulate_votes_for_election(election_2023, voters[:15], [
            pos_2023_chair, pos_2023_vice, pos_2023_coun
        ], datetime(2023, 3, 5, 12, 0, 0))

        # Simulate votes for 2024 (18 voters)
        self._simulate_votes_for_election(election_2024, voters[:18], [
            pos_2024_chair, pos_2024_vice, pos_2024_coun
        ], datetime(2024, 3, 5, 14, 0, 0))

        # Simulate votes for 2025 (5 voters so far)
        self._simulate_votes_for_2025(election_2025, voters[:5], cand_2025_profiles)

        # ==========================================
        # 8. GENERATE TALLY RESULTS FOR COMPLETED ELECTIONS
        # ==========================================
        self._generate_tally_results(election_2023, [pos_2023_chair, pos_2023_vice, pos_2023_coun])
        self._generate_tally_results(election_2024, [pos_2024_chair, pos_2024_vice, pos_2024_coun])

        # ==========================================
        # 9. CREATE AUDIT LOGS & METRICS
        # ==========================================
        AuditLog.objects.create(
            user_email=admin_user,
            action="2023 Election Completed",
            ip_address="127.0.0.1",
            prev_hash="0000",
            curr_hash="a1b2c3d4",
            timestamp=datetime(2023, 3, 7, 19, 0, 0)
        )
        
        AuditLog.objects.create(
            user_email=admin_user,
            action="2024 Election Completed",
            ip_address="127.0.0.1",
            prev_hash="a1b2c3d4",
            curr_hash="e5f6g7h8",
            timestamp=datetime(2024, 3, 7, 19, 0, 0)
        )
        
        AuditLog.objects.create(
            user_email=admin_user,
            action="2025 Election Started",
            ip_address="127.0.0.1",
            prev_hash="e5f6g7h8",
            curr_hash="i9j0k1l2",
            timestamp=timezone.now() - timedelta(days=1)
        )

        LoginAttempt.objects.create(user_email=admin_user, ip_address="192.168.1.5", status="SUCCESS")
        NetworkLog.objects.create(user_email=admin_user, ip_address="127.0.0.1", latency_ms=45, packet_loss=0.0, event_type="System Check")
        
        SystemMetric.objects.create(metric_name="CPU Usage", metric_value=12.5)
        SystemMetric.objects.create(metric_name="Memory Usage", metric_value=45.2)
        SystemMetric.objects.create(metric_name="Active Voters", metric_value=5.0)

        # ==========================================
        # 10. SUMMARY
        # ==========================================
        self.stdout.write(self.style.SUCCESS('=========================================='))
        self.stdout.write(self.style.SUCCESS('SEEDING COMPLETE!'))
        self.stdout.write(self.style.SUCCESS('=========================================='))
        self.stdout.write(self.style.SUCCESS('Elections Created:'))
        self.stdout.write(self.style.SUCCESS('  - 2023: Completed (15 voters)'))
        self.stdout.write(self.style.SUCCESS('  - 2024: Completed (18 voters)'))
        self.stdout.write(self.style.SUCCESS('  - 2025: Active (5 voters, 15 fresh)'))
        self.stdout.write(self.style.SUCCESS('=========================================='))
        self.stdout.write(self.style.SUCCESS('Login Credentials:'))
        self.stdout.write(self.style.SUCCESS('  Admin: admin@up.edu.ph / admin123'))
        self.stdout.write(self.style.SUCCESS('  Voter (Has Voted): voter1@up.edu.ph / password123'))
        self.stdout.write(self.style.SUCCESS('  Voter (Fresh): voter6@up.edu.ph / password123'))
        self.stdout.write(self.style.SUCCESS('=========================================='))

    def _create_candidates(self, cand_data, year, return_profiles=False):
        """Helper method to create candidates"""
        profiles = {}
        for email, name, party, alias, pos in cand_data:
            u = User.objects.create(
                email=email,
                name=name,
                password=make_password("password123"),
                role="candidate"
            )
            cp = CandidateProfile.objects.create(
                email=u,
                party=party,
                alias=alias,
                bio=f"Vote for {alias}! Candidate for {year}",
                is_verified=True
            )
            CandidateForPosition.objects.create(position=pos, candidate_email=cp)
            CandidateUpdate.objects.create(
                candidate_email=cp,
                content=f"[{year}] Campaign update from {alias}: Rally at AS Steps!",
                is_approved=True
            )
            profiles[email] = cp
        
        self.stdout.write(self.style.SUCCESS(f'Created {len(cand_data)} Candidates for {year}'))
        return profiles if return_profiles else None

    def _simulate_votes_for_election(self, election, voters, positions, vote_time):
        """Simulate votes for a completed election"""
        for voter in voters:
            for position in positions:
                # Get all candidates for this position
                candidates = CandidateForPosition.objects.filter(position=position)
                
                if position.choice_type == 'single':
                    # Vote for one candidate
                    selected = random.choice(candidates)
                    self._create_vote(election, voter, position, selected.candidate_email, vote_time)
                else:
                    # Vote for multiple (randomly select between 1 and max_winners)
                    num_votes = random.randint(1, min(position.max_winners, candidates.count()))
                    selected_candidates = random.sample(list(candidates), num_votes)
                    for cfp in selected_candidates:
                        self._create_vote(election, voter, position, cfp.candidate_email, vote_time)

    def _simulate_votes_for_2025(self, election, voters, candidate_profiles):
        """Simulate votes for 2025 active election (partial voting)"""
        vote_mappings = {
            0: ["chair1@up.edu.ph", "vice1@up.edu.ph", "coun1@up.edu.ph", "coun2@up.edu.ph", "coun3@up.edu.ph"],
            1: ["chair1@up.edu.ph", "vice1@up.edu.ph", "coun1@up.edu.ph", "coun4@up.edu.ph", "coun5@up.edu.ph"],
            2: ["chair2@up.edu.ph", "vice2@up.edu.ph", "coun2@up.edu.ph", "coun3@up.edu.ph", "coun6@up.edu.ph"],
            3: ["chair1@up.edu.ph", "vice2@up.edu.ph", "coun1@up.edu.ph", "coun5@up.edu.ph", "coun7@up.edu.ph"],
            4: ["chair2@up.edu.ph", "vice1@up.edu.ph", "coun4@up.edu.ph", "coun6@up.edu.ph", "coun8@up.edu.ph"],
        }
        
        for idx, voter in enumerate(voters):
            votes = vote_mappings[idx]
            for cand_email in votes:
                candidate = candidate_profiles[cand_email]
                position = CandidateForPosition.objects.get(candidate_email=candidate).position
                self._create_vote(election, voter, position, candidate, timezone.now())

        self.stdout.write(self.style.SUCCESS(f'Created votes for {len(voters)} voters in 2025 election'))

    def _create_vote(self, election, voter, position, candidate, vote_time):
        """Helper to create a single vote with receipt"""
        v = Vote.objects.create(
            election=election,
            voter_email=voter,
            position=position,
            candidate_email=candidate,
            encrypted_vote=f"encrypted_hash_{uuid.uuid4().hex[:16]}",
            idempotency_key=str(uuid.uuid4()),
            submission_latency_ms=random.randint(50, 300),
            timestamp=vote_time
        )
        VoteReceipt.objects.create(
            vote=v,
            ack_hash=str(uuid.uuid4()),
            client_timestamp=vote_time,
            retransmissions=random.randint(0, 2)
        )

    def _generate_tally_results(self, election, positions):
        """Generate tally results for completed elections"""
        for position in positions:
            candidates = CandidateForPosition.objects.filter(position=position)
            for cfp in candidates:
                # Count actual votes
                vote_count = Vote.objects.filter(
                    election=election,
                    position=position,
                    candidate_email=cfp.candidate_email
                ).count()
                
                TallyResult.objects.create(
                    election=election,
                    position=position,
                    candidate_email=cfp.candidate_email,
                    vote_count=vote_count
                )
        
        self.stdout.write(self.style.SUCCESS(f'Generated tally results for {election.title}'))
from django.shortcuts import render
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Prefetch
from django.db import transaction
from django.db.models import Count, Q
import uuid

import csv
import io
import random
import string
from django.contrib.auth.hashers import make_password
from django.http import HttpResponse

# Create your views here.
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status

from django.middleware.csrf import get_token
from django.contrib.auth.hashers import check_password
import uuid
from .models import User, Vote, Election, CandidateProfile, Position, VoterProfile, CandidateForPosition, TallyResult
from django.http import JsonResponse

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "UNIVOTE!"})

@api_view(['POST'])
def landing_view(request):
    return Response({"message": "Landing Page"})

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return JsonResponse({"error": "Email and password are required"}, status = 400)
    
    try:
        user = User.objects.get(email=email)

        if not check_password(password, user.password):
            return JsonResponse({"error": "Invalid Password"}, status=401)
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Map roles to dashboards
        role_dashboard_map = {
            'admin': '/admin-dashboard',
            'voter': '/voter-dashboard',
            'candidate': '/candidate-dashboard',
            'auditor': '/auditor-dashboard'
        }
        destination = role_dashboard_map.get(user.role, '/voter-dashboard')
            
        return Response({
            "message": "Login Successful",
            "role": user.role,
            "redirect_url": destination,
            "access_token": access_token,
            "refresh_token": str(refresh)
        })
        
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid Credentials"}, status=401)
        
@api_view(['POST'])
def logout_view(request):
    response = Response({"message": "Logged out successfully"})
    return response

@api_view(['POST'])
def voter_dashboard_view(request):
    return Response({"message": "Voter Dashboard"})

@api_view(['POST'])
def candidate_dashboard_view(request):
    return Response({"message": "Candidate Dashboard"})

@api_view(['GET', 'POST'])
def voting_page_view(request):
    current_user_email = "voter1@up.edu.ph" 
    
    voter_uuid = "NOT_FOUND"
    try:
        voter_profile = VoterProfile.objects.get(email=current_user_email)
        voter_uuid = voter_profile.voter_id
    except VoterProfile.DoesNotExist:
        voter_uuid = "No Profile"

    if request.method == 'GET':
        requested_position_name = request.GET.get('position', 'Chairperson')
        candidates_data = []
        
        max_votes_allowed = 1 

        try:
            position_obj = Position.objects.filter(name__iexact=requested_position_name).first()

            if position_obj:
                max_votes_allowed = position_obj.max_winners

                candidate_links = CandidateForPosition.objects.filter(position=position_obj).select_related(
                    'candidate_email',         
                    'candidate_email__email'  
                )

                for link in candidate_links:
                    cand_profile = link.candidate_email
                    user = cand_profile.email 
                    
                    student_no = "N/A"
                    try:
                        cand_voter_profile = VoterProfile.objects.get(email=user)
                        student_no = cand_voter_profile.student_number
                    except VoterProfile.DoesNotExist:
                        pass

                    candidates_data.append({
                        "id": user.email,
                        "name": user.name,
                        "student_number": student_no,
                        "alias": cand_profile.alias if cand_profile.alias else "",
                        "party": cand_profile.party,
                        "position": position_obj.name,
                        "description": cand_profile.bio if cand_profile.bio else "No description provided.",
                        "image": cand_profile.image_url
                    })

        except Exception as e:
            print(f"Error fetching candidates: {e}")

        return Response({
            "voter_id": voter_uuid, 
            "max_votes": max_votes_allowed,
            "candidates": candidates_data
        })

    elif request.method == 'POST':
        try:
            user = User.objects.get(email=current_user_email)
            selected_candidate_ids = request.data.get('candidates', []) 
            election = Election.objects.first()

            if Vote.objects.filter(voter_email=user).exists():
                 return Response({"error": "You have already cast your votes!"}, status=400)

            for cand_email in selected_candidate_ids:
                candidate = CandidateProfile.objects.get(email=cand_email)
                
                link = CandidateForPosition.objects.filter(candidate_email=candidate).first()
                
                if link:
                    Vote.objects.create(
                        election=election,
                        voter_email=user,
                        position=link.position,
                        candidate_email=candidate,
                        encrypted_vote="encrypted_dummy_string",
                        idempotency_key=str(uuid.uuid4()), 
                    )

            return Response({"message": "Votes submitted successfully!"}, status=200)

        except Exception as e:
            print(f"Error submitting vote: {e}")
            return Response({"error": str(e)}, status=500)
            
@api_view(['GET', 'POST'])
def manage_profile_page_view(request):
    
    target_email = "candidate@up.edu.ph" 
    
    if request.method == 'GET':
        try:
            user_obj = User.objects.get(email=target_email)

            candidate_profile = CandidateProfile.objects.get(email=user_obj)

            voter_profile = VoterProfile.objects.get(email=user_obj)

            link_entry = CandidateForPosition.objects.filter(candidate_email=candidate_profile).first()
            
            if link_entry:
                position_name = link_entry.position.name
            else:
                position_name = "No Position Assigned"

            profile_data = [{
                "name": user_obj.name,
                "party_name": candidate_profile.party,
                "alias": candidate_profile.alias,
                "position": position_name 
            }]

            return Response({"voter_id": voter_profile.voter_id, "profile": profile_data})

        except Exception as e:
            print(f"Error: {e}")
            return Response({"voter_id": "Error", "profile": []})
        
    elif request.method == 'POST':
        try:
            user_obj = User.objects.get(email=target_email)
            profile = CandidateProfile.objects.get(email=user_obj)

            new_party = request.data.get('party_name')
            new_alias = request.data.get('alias')

            profile.party = new_party
            profile.alias = new_alias
            profile.save()

            return Response({"message": "Profile updated successfully!"}, status=200)

        except Exception as e:
            print(f"Error saving profile: {e}")
            return Response({"error": "Failed to save profile"}, status=500)
    
@api_view(['GET', 'POST'])
def vote_receipt_page_view(request):
    current_user_email = "voter1@up.edu.ph"

    if request.method == 'GET':
        try:
            user = User.objects.get(email=current_user_email)
            
            my_votes = Vote.objects.filter(voter_email=user).select_related('candidate_email', 'position', 'candidate_email__email')

            chairperson = "None"
            vice_chairperson = "None"
            councilors = []
            
            for vote in my_votes:
                pos_name = vote.position.name
                cand_name = vote.candidate_email.email.name 

                if pos_name == "Chairperson":
                    chairperson = cand_name
                elif pos_name == "Vice Chairperson":
                    vice_chairperson = cand_name
                elif "Councilor" in pos_name:
                    councilors.append(cand_name)

            now = timezone.now()
            
            voter_profile = VoterProfile.objects.get(email=user)

            return Response({
                "voter_id": voter_profile.voter_id,
                "receipt_id": str(uuid.uuid4()),
                "chairperson": chairperson,
                "vice_chairperson": vice_chairperson,
                "councilor": councilors,
                "date": now.strftime("%B %d, %Y"), 
                "time": now.strftime("%I:%M %p"),
            })

        except Exception as e:
            print(f"Error generating receipt: {e}")
            return Response({"error": "No votes found"}, status=404)

    elif request.method == 'POST':
        return Response({"message": "Manage Profile Page"})
    
@api_view(['GET'])
def view_candidate_page_view(request, id):
    target_email = id 

    try:
        candidate = CandidateProfile.objects.select_related('email').get(email=target_email)
        user = candidate.email 

        pos_link = CandidateForPosition.objects.filter(candidate_email=candidate).select_related('position').first()
        position_name = pos_link.position.name if pos_link else "Unassigned"

        student_number = "N/A"
        try:
            voter_profile = VoterProfile.objects.get(email=user)
            student_number = voter_profile.student_number
        except VoterProfile.DoesNotExist:
            pass

        candidate_data = {
            "id": user.email,
            "name": user.name,
            "student_number": student_number,
            "alias": candidate.alias if candidate.alias else "",
            "party": candidate.party,
            "position": position_name,
            "description": candidate.bio if candidate.bio else "No description provided.",
            "image": candidate.image_url
        }

        return Response({"candidate": candidate_data})

    except CandidateProfile.DoesNotExist:
        return Response({"error": "Candidate not found"}, status=404)
    except Exception as e:
        print(f"Error fetching candidate details: {e}")
        return Response({"error": "Internal Server Error"}, status=500)
    
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_dashboard_view(request):
    if request.method == 'GET':
        year = request.GET.get('year', '2025')
        
        try:
            election = Election.objects.get(title__icontains=year)
            positions = Position.objects.filter(election=election).select_related('election')
        except Election.DoesNotExist:
            return Response({"error": f"{year} election not found"}, status=404)
        except Election.MultipleObjectsReturned:
            election = Election.objects.filter(title__icontains=year).order_by('-start_datetime').first()
            positions = Position.objects.filter(election=election).select_related('election')
        
        response_data = {}

        for pos in positions:
            candidates_links = CandidateForPosition.objects.filter(position=pos).select_related('candidate_email', 'candidate_email__email')
            candidates_list = []
            for link in candidates_links:
                cand = link.candidate_email
                user = cand.email
                student_number = "N/A"
                try:
                    voter_profile = VoterProfile.objects.get(email=user)
                    student_number = voter_profile.student_number
                except VoterProfile.DoesNotExist:
                    pass

                candidates_list.append({
                    "id": user.email,
                    "name": user.name,
                    "student_number": student_number,
                    "alias": cand.alias if cand.alias else "",
                    "party": cand.party,
                    "position": pos.name,
                    "description": cand.bio if cand.bio else "No description provided.",
                    "image": cand.image_url
                })
            
            key = pos.name.lower().replace(" ", "_") + "s"
            response_data[key] = candidates_list

        return Response(response_data)

    elif request.method == 'POST':
        return Response({"message": "Admin Dashboard Page"})

@api_view(['GET', 'POST', 'DELETE'])
def manage_candidates_view(request, id=None):
    """
    GET: Return list of candidates by position.
    POST: Add a new candidate.
    DELETE: Remove a candidate by email (id parameter).
    """
    # ------------------- GET ------------------- #
    if request.method == 'GET':
        try:
            election = Election.objects.get(title__icontains='2025')
        except Election.DoesNotExist:
            return Response({"error": "election not found"}, status=404)
        except Election.MultipleObjectsReturned:
            election = Election.objects.filter(title__icontains='2025').order_by('-start_datetime').first()

        chairpersons = []
        vice_chairpersons = []
        councilors = []

        # Filter CandidateForPosition by positions
        for link in CandidateForPosition.objects.filter(
            position__election=election
        ).select_related('candidate_email', 'candidate_email__email', 'position'):
            candidate = link.candidate_email
            pos_name = link.position.name
            
            # Get student number from VoterProfile
            student_number = "N/A"
            try:
                voter_profile = VoterProfile.objects.get(email=candidate.email)
                student_number = voter_profile.student_number
            except VoterProfile.DoesNotExist:
                pass
            
            cand_data = {
                "id": candidate.email.email,
                "name": candidate.email.name,
                "student_number": student_number,
                "alias": candidate.alias or "",
                "party": candidate.party or "",
                "position": pos_name,
                "description": candidate.bio or "No description provided.",
                "image": candidate.image_url or None
            }

            if pos_name.lower() == "chairperson":
                chairpersons.append(cand_data)
            elif pos_name.lower() == "vice chairperson":
                vice_chairpersons.append(cand_data)
            elif "councilor" in pos_name.lower():
                councilors.append(cand_data)

        return Response({
            "chairpersons": chairpersons,
            "vice_chairpersons": vice_chairpersons,
            "councilors": councilors
        })

    # ------------------- POST ------------------- #
    elif request.method == 'POST':
        data = request.data
        email = data.get("email")
        name = data.get("name")
        student_number = data.get("student_number")
        position_name = data.get("position")
        alias = data.get("alias", "")
        party = data.get("party", "")
        description = data.get("description", "")

        if not email or not name or not position_name:
            return Response({"error": "Email, name, and position are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get the 2025 election
            election = Election.objects.get(title__icontains='2025')
        except Election.DoesNotExist:
            return Response({"error": "2025 election not found"}, status=404)
        except Election.MultipleObjectsReturned:
            election = Election.objects.filter(title__icontains='2025').order_by('-start_datetime').first()

        try:
            with transaction.atomic():
                # Create User if not exists
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "name": name,
                        "password": "defaultpassword",
                        "role": "candidate"
                    }
                )

                # Create VoterProfile if not exists
                if not VoterProfile.objects.filter(email=user).exists():
                    VoterProfile.objects.create(
                        email=user,
                        student_number=student_number or "N/A",
                        course="N/A",
                        year_level=1
                    )

                # Create or get CandidateProfile
                candidate_profile, created = CandidateProfile.objects.get_or_create(
                    email=user,
                    defaults={
                        "party": "",
                        "alias": "",
                        "bio": "",
                        "image_url": ""
                    }
                )

                # Update alias, party, description
                candidate_profile.alias = alias
                candidate_profile.party = party
                candidate_profile.bio = description
                candidate_profile.save()

                # Get or create position for the 2025 election
                position_obj, created = Position.objects.get_or_create(
                    name=position_name,
                    election=election,
                    defaults={"max_winners": 1, "choice_type": "single"}
                )

                # Check if candidate is already assigned to this position
                if not CandidateForPosition.objects.filter(
                    position=position_obj,
                    candidate_email=candidate_profile
                ).exists():
                    CandidateForPosition.objects.create(
                        position=position_obj,
                        candidate_email=candidate_profile
                    )

            return Response({"message": f"{name} added successfully as {position_name}."})

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ------------------- DELETE ------------------- #
    elif request.method == 'DELETE':
        if not id:
            return Response({"error": "Candidate ID (email) is required."}, status=400)

        try:
            # id is candidate's email
            user = User.objects.get(email=id)
            candidate_profile = CandidateProfile.objects.get(email=user)

            # Delete CandidateForPosition links first
            CandidateForPosition.objects.filter(candidate_email=candidate_profile).delete()
            # Delete CandidateProfile
            candidate_profile.delete()
            # Optional: delete VoterProfile
            # VoterProfile.objects.filter(email=user).delete()
            # Optional: delete User
            # user.delete()

            return Response({"message": f"Candidate {user.name} removed successfully."}, status=200)

        except User.DoesNotExist:
            return Response({"error": "Candidate user not found."}, status=404)
        except CandidateProfile.DoesNotExist:
            return Response({"error": "Candidate profile not found."}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
@api_view(['GET'])
def view_previous_results(request):
    year = request.GET.get('year', '2024')
    
    # Get the election for the specified year
    try:
        election = Election.objects.get(
            start_datetime__year=year,
            # is_active=False
        )
    except Election.DoesNotExist:
        # Return empty/test data if election doesn't exist
        return Response({
            "voter_results": [],
            "total_voters": 0,
            "total_number_of_voters": 0,
            "chairperson_results": [],
            "vice_chairperson_results": [],
            "councilor_results": []
        })
    
    # Get voter turnout by course
    voter_results = []
    courses = VoterProfile.objects.values_list('course', flat=True).distinct()
    
    for course in courses:
        total_students = VoterProfile.objects.filter(course=course).count()
        votes = Vote.objects.filter(
            election=election,
            voter_email__voterprofile__course=course
        ).values('voter_email').distinct().count()
        
        voter_results.append({
            "program": course,
            "votes": votes,
            "total_students": total_students
        })
    
    # Calculate totals
    total_voters = Vote.objects.filter(election=election).values('voter_email').distinct().count()
    total_number_of_voters = VoterProfile.objects.filter(is_eligible=True).count()
    
    # Helper function to get results for a position
    def get_position_results(position_name):
        try:
            position = Position.objects.get(election=election, name=position_name)
            
            # Try to get from TallyResult first (official results)
            tally_results = TallyResult.objects.filter(
                election=election,
                position=position
            ).select_related('candidate_email', 'candidate_email__email')
            
            if tally_results.exists():
                return [
                    {
                        "name": tr.candidate_email.email.name,
                        "votes": tr.vote_count
                    }
                    for tr in tally_results
                ]
            
            # If no tally results, count from Vote table
            votes = Vote.objects.filter(
                election=election,
                position=position
            ).values('candidate_email__email__name').annotate(
                vote_count=Count('id')
            ).order_by('-vote_count')
            
            return [
                {
                    "name": vote['candidate_email__email__name'],
                    "votes": vote['vote_count']
                }
                for vote in votes
            ]
            
        except Position.DoesNotExist:
            return []
    
    # Get results for each position
    chairperson_results = get_position_results("Chairperson")
    vice_chairperson_results = get_position_results("Vice Chairperson")
    councilor_results = get_position_results("Councilor")
    
    return Response({
        "voter_results": voter_results,
        "total_voters": total_voters,
        "total_number_of_voters": total_number_of_voters,
        "chairperson_results": chairperson_results,
        "vice_chairperson_results": vice_chairperson_results,
        "councilor_results": councilor_results
    })

@api_view(['GET'])
def auditor_dashboard_view(request):
    
    try:
        current_election = Election.objects.filter(is_active=True).first()
        
        if not current_election:
            return Response({"error": "No active election found"}, status=404)
        
        # Get all programs
        all_courses = VoterProfile.objects.values_list('course', flat=True).distinct()
        
        voter_test_data = []
        for course in all_courses:
            total_students = VoterProfile.objects.filter(course=course).count()

            #Get unique emails from voters and count            
            voted_count = Vote.objects.filter(
                election=current_election,
                voter_email__voterprofile__course=course
            ).values('voter_email').distinct().count()
            
            voter_test_data.append({
                "program": course,
                "votes": voted_count,
                "total_students": total_students
            })
        
        voter_test_data.sort(key=lambda x: x['program'])
        
        # chairperson results
        chairperson_position = Position.objects.filter(
            election=current_election,
            name__iexact="Chairperson"
        ).first()
        
        chairperson_results = []
        if chairperson_position:
            chairperson_votes = Vote.objects.filter(
                election=current_election,
                position=chairperson_position
            ).values('candidate_email__email__name').annotate(
                vote_count=Count('id')
            ).order_by('-vote_count')
            
            chairperson_results = [
                {"name": item['candidate_email__email__name'], "votes": item['vote_count']}
                for item in chairperson_votes
            ]
        
        # vice chairperson results
        vice_position = Position.objects.filter(
            election=current_election,
            name__iexact="Vice Chairperson"
        ).first()
        
        vice_chairperson_results = []
        if vice_position:
            vice_votes = Vote.objects.filter(
                election=current_election,
                position=vice_position
            ).values('candidate_email__email__name').annotate(
                vote_count=Count('id')
            ).order_by('-vote_count')
            
            vice_chairperson_results = [
                {"name": item['candidate_email__email__name'], "votes": item['vote_count']}
                for item in vice_votes
            ]
        
        # councilor results
        councilor_position = Position.objects.filter(
            election=current_election,
            name__icontains="Councilor"
        ).first()
        
        councilor_results = []
        if councilor_position:
            councilor_votes = Vote.objects.filter(
                election=current_election,
                position=councilor_position
            ).values('candidate_email__email__name').annotate(
                vote_count=Count('id')
            ).order_by('-vote_count')
            
            councilor_results = [
                {"name": item['candidate_email__email__name'], "votes": item['vote_count']}
                for item in councilor_votes
            ]
        
        # total voters
        total_voters = sum(item['votes'] for item in voter_test_data)
        total_number_of_voters = sum(item['total_students'] for item in voter_test_data)
        

        return Response({
            "voter_results": voter_test_data,
            "total_voters": total_voters,
            "total_number_of_voters": total_number_of_voters,
            "chairperson_results": chairperson_results,
            "vice_chairperson_results": vice_chairperson_results,
            "councilor_results": councilor_results
        })
        
    except Exception as e:
        print(f"Error in auditor dashboard: {e}")
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_voters_view(request):
    if 'file' not in request.FILES:
        return HttpResponse("No file uploaded", status=400)

    file_obj = request.FILES['file']
    decoded_file = file_obj.read().decode('utf-8')
    io_string = io.StringIO(decoded_file)
    reader = csv.DictReader(io_string)
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="voter_credentials.csv"'

    writer = csv.writer(response)
    writer.writerow(['Name', 'Email', 'Password', 'Status'])

    for row in reader:
        try:
            student_no = row.get('student_number')
            name = row.get('name')
            program = row.get('program')
            email = row.get('email')
            year_level = row.get('year_level', 1)

            if User.objects.filter(email=email).exists():
                writer.writerow([name, email, "N/A", "Skipped: Already Exists"])
                continue

            plain_password = generate_password() 

            user = User.objects.create(
                email=email,
                name=name,
                password=make_password(plain_password), 
                role="voter"
            )

            VoterProfile.objects.create(
                email=user,
                student_number=student_no,
                course=program,
                year_level=int(year_level)
            )
            
            writer.writerow([name, email, plain_password, "Created"])

        except Exception as e:
            writer.writerow([row.get('name', 'Unknown'), row.get('email', 'Unknown'), "N/A", f"Error: {str(e)}"])

    return response

def generate_password(length=10):
    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    
    password_chars = [
        random.choice(upper),
        random.choice(lower),
        random.choice(digits)
    ]

    all_chars = upper + lower + digits
    for _ in range(length - 3):
        password_chars.append(random.choice(all_chars))
        
    random.shuffle(password_chars)

    return "".join(password_chars)


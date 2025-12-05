from django.shortcuts import render
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Prefetch
import uuid

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import User, Vote, Election, CandidateProfile, Position, VoterProfile, CandidateForPosition

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "UNIVOTE!"})

@api_view(['POST'])
def landing_view(request):
    return Response({"message": "Landing Page"})

@api_view(['POST'])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    role = request.data.get('role')

    dashboard_urls = {
        'Admin': '/admin-dashboard',
        'Candidate': '/candidate-dashboard',
        'Voter': '/voter-dashboard',
        'Auditor': '/auditor-dashboard'
    }

    if email == "voter@up.edu.ph" and password == "password0123.." and role == "Voter":
        return Response({
            "message": "Login Successful!",
            "redirect_url": dashboard_urls.get(role, '/voter-dashboard'),
            "role": role
        }, status=200)
    
    if email == "admin@up.edu.ph" and password == "password0123.." and role == "Admin":
        return Response({
            "message": "Login Successful!",
            "redirect_url": dashboard_urls.get(role, '/admin-dashboard'),
            "role": role
        }, status=200)
    
    if email == "candidate@up.edu.ph" and password == "password0123.." and role == "Candidate":
        return Response({
            "message": "Login Successful!",
            "redirect_url": dashboard_urls.get(role, '/candidate-dashboard'),
            "role": role
        }, status=200)
    
    if email == "auditor@up.edu.ph" and password == "password0123.." and role == "Auditor":
        return Response({
            "message": "Login Successful!",
            "redirect_url": dashboard_urls.get(role, '/auditor-dashboard'),
            "role": role
        }, status=200)
        
    else:
        return Response({"message": "Invalid credentials."}, status=401)

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
def admin_dashboard_view(request):
    if request.method == 'GET':
        positions = Position.objects.select_related('election').all()
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
            
            # Use lowercase keys for response
            key = pos.name.lower().replace(" ", "_") + "s"
            response_data[key] = candidates_list

        return Response(response_data)

    elif request.method == 'POST':
        return Response({"message": "Admin Dashboard Page"})

@api_view(['GET', 'POST'])
def manage_candidates_view(request):
    if request.method == 'GET':
        return admin_dashboard_view(request)  # reuse the admin dashboard logic

    elif request.method == 'POST':
        return Response({"message": "Manage Candidates Page"})

    
@api_view(['GET', 'POST'])
def view_previous_results(request):

    voter_test_data = [
        { "program": "BS Accountancy", "votes": 90, "total_students": 100 },
        { "program": "BS Applied Mathematics", "votes": 52, "total_students": 100 },
        { "program": "BS Biology", "votes": 50, "total_students": 104 },
        { "program": "BS Computer Science", "votes": 38, "total_students": 60 },
        { "program": "BS Economics", "votes": 12, "total_students": 70 },
        { "program": "BA Literature", "votes": 55, "total_students": 60 },
        { "program": "BS Management", "votes": 24, "total_students": 55 },   
        { "program": "BS Media Arts", "votes": 27, "total_students": 54 },   
        { "program": "BA Political Science", "votes": 29, "total_students":  40},   
    ]

    chairperson_results = [
        {"name": "Juan Dela Cruz", "votes": 200},
        {"name": "Maria Santos", "votes": 40},
    ]
    vice_chairperson_results = [
        {"name": "Pedro Reyes", "votes": 150},
        {"name": "Ana Lopez", "votes": 123},
    ]
    councilor_results = [
        {"name": "Carlos Garcia", "votes": 110},
        {"name": "Luisa Fernandez", "votes": 100},
        {"name": "Mark Rivera", "votes": 90},
        {"name": "Sofia Santos", "votes": 80},
        {"name": "Carlos Mendoza", "votes": 70},
        {"name": "Lea Fernandez", "votes": 60},
        {"name": "Jasper Cruz", "votes": 50},
        {"name": "Bianca Flores", "votes": 40},
    ]

    

    total_voters = sum(item['votes'] for item in voter_test_data) #VOTED
    total_number_of_voters = sum(item['total_students'] for item in voter_test_data) #TOTAL

    return Response({"voter_results": voter_test_data, 
                     "total_voters": total_voters, 
                     "total_number_of_voters": total_number_of_voters,
                     "chairperson_results": chairperson_results,
                     "vice_chairperson_results": vice_chairperson_results,
                     "councilor_results": councilor_results
                     })

@api_view(['GET', 'POST'])
def aduditor_dashboard_view(request):

    current_voter_test_data = [
        { "program": "BS Accountancy", "votes": 25, "total_students": 100 },
        { "program": "BS Applied Mathematics", "votes": 52, "total_students": 100 },
        { "program": "BS Biology", "votes": 45, "total_students": 90 },
        { "program": "BS Computer Science", "votes": 38, "total_students": 80 },
        { "program": "BS Economics", "votes": 27, "total_students": 70 },
        { "program": "BA Literature", "votes": 27, "total_students": 60 },
        { "program": "BS Management", "votes": 24, "total_students": 50 },   
        { "program": "BS Media Arts", "votes": 24, "total_students": 50 },   
        { "program": "BA Political Science", "votes": 24, "total_students": 50 },   
    ]

    current_chairperson_results = [
        { "name": "Adrian Velasco", "votes": 150 },
        { "name": "Renee Alvarado", "votes": 120 }
    ]
    current_vice_chairperson_results = [
        { "name": "Miguel Soriano", "votes": 140 },
        { "name": "Ella Navarro", "votes": 130 }
    ]
    current_councilor_results = [
        { "name": "Julian Torres", "votes": 110 },
        { "name": "Katrina Dominguez", "votes": 100 },
        { "name": "Noel Santiago", "votes": 90 },
        { "name": "Isabelle Ramos", "votes": 80 },
        { "name": "Rafael Bautista", "votes": 70 },
        { "name": "Mira Gutierrez", "votes": 60 },
        { "name": "Dylan Mercado", "votes": 50 },
        { "name": "Faith Salcedo", "votes": 40 }
    ]

    

    current_total_voters = sum(item['votes'] for item in current_voter_test_data) #VOTED
    current_total_number_of_voters = sum(item['total_students'] for item in current_voter_test_data) #TOTAL

    return Response({"voter_results": current_voter_test_data, 
                     "total_voters": current_total_voters, 
                     "total_number_of_voters": current_total_number_of_voters,
                     "chairperson_results": current_chairperson_results,
                     "vice_chairperson_results": current_vice_chairperson_results,
                     "councilor_results": current_councilor_results
                     })
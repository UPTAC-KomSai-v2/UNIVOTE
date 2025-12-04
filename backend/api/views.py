from django.shortcuts import render
from django.shortcuts import get_object_or_404
# from .models import Candidate
# from .serializers import CandidateSerializer

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view

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
    voter_id = 1234567890  # Hardcoded voter ID for testing
    chairpersonCandidates = [
        {
            "id": 1,
            "name": "Juan Dela Cruz",
            "student_number": "202100123",
            "alias": "JuanCruz",
            "party": "Party A",
            "position": "Chairperson",
            "description": "A dedicated student leader committed to excellence.",
            "image": None
        },
        {
            "id": 2,
            "name": "Maria Santos",
            "student_number": "202100456",
            "alias": "MariaS",
            "party": "Party B",
            "position": "Chairperson",
            "description": "Focused on transparency and student welfare.",
            "image": None
        }
    ]
    viceChairpersonCandidates = [
        {
            "id": 3,
            "name": "Pedro Reyes",
            "student_number": "202100789",
            "alias": "PedroR",
            "party": "Party A",
            "position": "Vice Chairperson",
            "description": "Advocate for student rights and community engagement.",
            "image": None
        },
        {
            "id": 4,
            "name": "Ana Lopez",
            "student_number": "202100321",
            "alias": "AnaL",
            "party": "Party B",
            "position": "Vice Chairperson",
            "description": "Committed to fostering a supportive campus environment.",
            "image": None
        }
    ]
    counsilorCandidates = [
        {
            "id": 5,
            "name": "Carlos Garcia",
            "student_number": "202100654",
            "alias": "CarlosG",
            "party": "Party A",
            "position": "Councilor",
            "description": "Passionate about academic excellence and student services.",
            "image": None
        },
        {
            "id": 6,
            "name": "Luisa Fernandez",
            "student_number": "202100987",
            "alias": "LuisaF",
            "party": "Party B",
            "position": "Councilor",
            "description": "Dedicated to enhancing campus life and student engagement.",
            "image": None
        }
    ]

    
    if request.method == 'GET':
        position = request.GET.get('position', 'Chairperson')

        candidate_map = {
            'Chairperson': chairpersonCandidates,
            'Vice Chairperson': viceChairpersonCandidates,
            'Councilors': counsilorCandidates
        }

        return_candidates = candidate_map.get(position, [])


        return Response({"voter_id": voter_id, "candidates": return_candidates})
    
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Voting Page"})
    
@api_view(['GET', 'POST'])
def manage_profile_page_view(request):
    voter_id = 202212345  # Hardcoded voter ID for testing
    profile = [{
        "name": "Richard Julius Raphael Brian Constantine De Luka Doncic",
        "party_name": "Party A",
        "alias": "RJRBCD",
        "position": "Chairperson",
    }]
    
    if request.method == 'GET':
        return Response({"voter_id": voter_id, "profile": profile})
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Manage Profile Page"})
    
@api_view(['GET', 'POST'])
def vote_receipt_page_view(request):
    voter_id = 202212345
    receipt_id = "s1Uc3K56M812Y89D163Ck"
    chairperson = "chairperson2025"
    vice_chairperson = "vice_chairperson2022"
    councilor = [
        "councilor1_2023",
        "councilor2_2024",
        "councilor3_2025",
        "councilor4_2022",
        "councilor5_2023",
        "councilor6_2024",
    ]
    date = "December 25, 2025"
    time = "10:30 AM"

    
    if request.method == 'GET':
        return Response({
            "voter_id": voter_id,
            "receipt_id": receipt_id,
            "chairperson": chairperson,
            "vice_chairperson": vice_chairperson,
            "councilor": councilor,
            "date": date,
            "time": time,
        })
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Manage Profile Page"})
    
@api_view(['GET'])
def view_candidate_page_view(request, id):
    chairpersonCandidates = [
        {
            "id": 1,
            "name": "Juan Dela Cruz",
            "student_number": "202100123",
            "alias": "JuanCruz",
            "party": "Party A",
            "position": "Chairperson",
            "description": "A dedicated student leader committed to excellence.",
            "image": None
        },
        {
            "id": 2,
            "name": "Maria Santos",
            "student_number": "202100456",
            "alias": "MariaS",
            "party": "Party B",
            "position": "Chairperson",
            "description": "Focused on transparency and student welfare.",
            "image": None
        }
    ]

    viceChairpersonCandidates = [
        {
            "id": 3,
            "name": "Pedro Reyes",
            "student_number": "202100789",
            "alias": "PedroR",
            "party": "Party A",
            "position": "Vice Chairperson",
            "description": "Advocate for student rights and community engagement.",
            "image": None
        },
        {
            "id": 4,
            "name": "Ana Lopez",
            "student_number": "202100321",
            "alias": "AnaL",
            "party": "Party B",
            "position": "Vice Chairperson",
            "description": "Committed to fostering a supportive campus environment.",
            "image": None
        }
    ]

    councilorCandidates = [
        {
            "id": 5,
            "name": "Carlos Garcia",
            "student_number": "202100654",
            "alias": "CarlosG",
            "party": "Party A",
            "position": "Councilor",
            "description": "Passionate about academic excellence and student services.",
            "image": None
        },
        {
            "id": 6,
            "name": "Luisa Fernandez",
            "student_number": "202100987",
            "alias": "LuisaF",
            "party": "Party B",
            "position": "Councilor",
            "description": "Dedicated to enhancing campus life and student engagement.",
            "image": None
        }
    ]

    all_candidates = chairpersonCandidates + viceChairpersonCandidates + councilorCandidates
    candidate = next((c for c in all_candidates if c["id"] == int(id)), None)

    if request.method == 'GET':
        if not candidate:
            return Response({"error": "Candidate not found"}, status=404)
        
        return Response({"candidate": candidate})
    
@api_view(['GET', 'POST'])
def admin_dashboard_view(request):
    voter_id = 1234567890  # Hardcoded voter ID for testing
    chairpersonCandidates = [
        {
            "id": 1,
            "name": "Juan Dela Cruz",
            "student_number": "202100123",
            "alias": "JuanCruz",
            "party": "Party A",
            "position": "Chairperson",
            "description": "A dedicated student leader committed to excellence.",
            "image": None
        },
        {
            "id": 2,
            "name": "Maria Santos",
            "student_number": "202100456",
            "alias": "MariaS",
            "party": "Party B",
            "position": "Chairperson",
            "description": "Focused on transparency and student welfare.",
            "image": None
        }
    ]
    viceChairpersonCandidates = [
        {
            "id": 3,
            "name": "Pedro Reyes",
            "student_number": "202100789",
            "alias": "PedroR",
            "party": "Party A",
            "position": "Vice Chairperson",
            "description": "Advocate for student rights and community engagement.",
            "image": None
        },
        {
            "id": 4,
            "name": "Ana Lopez",
            "student_number": "202100321",
            "alias": "AnaL",
            "party": "Party B",
            "position": "Vice Chairperson",
            "description": "Committed to fostering a supportive campus environment.",
            "image": None
        }
    ]
    counsilorCandidates = [
        {
            "id": 5,
            "name": "Carlos Garcia",
            "student_number": "202100654",
            "alias": "CarlosG",
            "party": "Party A",
            "position": "Councilor",
            "description": "Passionate about academic excellence and student services.",
            "image": None
        },
        {
            "id": 6,
            "name": "Luisa Fernandez",
            "student_number": "202100987",
            "alias": "LuisaF",
            "party": "Party B",
            "position": "Councilor",
            "description": "Dedicated to enhancing campus life and student engagement.",
            "image": None
        }
    ]

    
    if request.method == 'GET':
        return Response({
            "voter_id": voter_id,
            "chairpersons": chairpersonCandidates,
            "vice_chairpersons": viceChairpersonCandidates,
            "councilors": counsilorCandidates
        })
    
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Admin Dashboard Page"})

@api_view(['GET', 'POST'])
def manage_candidates_view(request):
    voter_id = 1234567890  # Hardcoded voter ID for testing
    chairpersonCandidates = [
        {
            "id": 1,
            "name": "Juan Dela Cruz",
            "student_number": "202100123",
            "alias": "JuanCruz",
            "party": "Party A",
            "position": "Chairperson",
            "description": "A dedicated student leader committed to excellence.",
            "image": None
        },
        {
            "id": 2,
            "name": "Maria Santos",
            "student_number": "202100456",
            "alias": "MariaS",
            "party": "Party B",
            "position": "Chairperson",
            "description": "Focused on transparency and student welfare.",
            "image": None
        }
    ]
    viceChairpersonCandidates = [
        {
            "id": 3,
            "name": "Pedro Reyes",
            "student_number": "202100789",
            "alias": "PedroR",
            "party": "Party A",
            "position": "Vice Chairperson",
            "description": "Advocate for student rights and community engagement.",
            "image": None
        },
        {
            "id": 4,
            "name": "Ana Lopez",
            "student_number": "202100321",
            "alias": "AnaL",
            "party": "Party B",
            "position": "Vice Chairperson",
            "description": "Committed to fostering a supportive campus environment.",
            "image": None
        }
    ]
    counsilorCandidates = [
        {
            "id": 5,
            "name": "Carlos Garcia",
            "student_number": "202100654",
            "alias": "CarlosG",
            "party": "Party A",
            "position": "Councilor",
            "description": "Passionate about academic excellence and student services.",
            "image": None
        },
        {
            "id": 6,
            "name": "Luisa Fernandez",
            "student_number": "202100987",
            "alias": "LuisaF",
            "party": "Party B",
            "position": "Councilor",
            "description": "Dedicated to enhancing campus life and student engagement.",
            "image": None
        }
    ]

    
    if request.method == 'GET':
        return Response({
            "voter_id": voter_id,
            "chairpersons": chairpersonCandidates,
            "vice_chairpersons": viceChairpersonCandidates,
            "councilors": counsilorCandidates
        })
    
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Manage Candidates Page"})
    
@api_view(['GET', 'POST'])
def view_previous_results(request):

    voter_test_data = [
        { "program": "BS Accountancy", "votes": 52, "total_students": 120 },
        { "program": "BS Applied Mathematics", "votes": 52, "total_students": 100 },
        { "program": "BS Biology", "votes": 45, "total_students": 90 },
        { "program": "BS Computer Science", "votes": 38, "total_students": 80 },
        { "program": "BS Economics", "votes": 27, "total_students": 70 },
        { "program": "BA Literature", "votes": 27, "total_students": 60 },
        { "program": "BS Management", "votes": 24, "total_students": 50 },   
        { "program": "BS Media Arts", "votes": 24, "total_students": 50 },   
        { "program": "BA Political Science", "votes": 24, "total_students": 50 },   
    ]

    chairperson_results = [
        {"name": "Juan Dela Cruz", "votes": 150},
        {"name": "Maria Santos", "votes": 120},
    ]
    vice_chairperson_results = [
        {"name": "Pedro Reyes", "votes": 140},
        {"name": "Ana Lopez", "votes": 130},
    ]
    councilor_results = [
        {"name": "Carlos Garcia", "votes": 160},
        {"name": "Luisa Fernandez", "votes": 110},
    ]

    total_voters = sum(item['votes'] for item in voter_test_data) #VOTED
    total_number_of_voters = sum(item['total_students'] for item in voter_test_data) #TOTAL

    return Response({"voter_results": voter_test_data, 
                     "total_voters": total_voters, 
                     "total_number_of_voters": total_number_of_voters,
                     "chairperson_results": chairperson_results,
                     "vice_chairperson_results": vice_chairperson_results,
                     "councilor_results": councilor_results,
    })
from django.shortcuts import render

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

    #TEST DATA TO SEE IF IT GOES THROUGH
    if email == "admin@up.edu.ph" and password == "password0123..":
        return Response({"message": "Login Successful!"}, status=200)
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
    
    if request.method == 'GET':
        return Response({"voter_id": voter_id})
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Voting Page"})
    
@api_view(['GET', 'POST'])
def manage_profile_page_view(request):
    voter_id = 202212345  # Hardcoded voter ID for testing
    
    if request.method == 'GET':
        return Response({"voter_id": voter_id})
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

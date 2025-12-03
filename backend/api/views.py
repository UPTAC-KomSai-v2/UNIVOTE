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

@api_view(['GET', 'POST'])
def voting_page_view(request):
    voter_id = 1234567890  # Hardcoded voter ID for testing
    
    if request.method == 'GET':
        return Response({"voter_id": voter_id})
    elif request.method == 'POST':
        # Handle POST request
        return Response({"message": "Voting Page"})

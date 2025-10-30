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
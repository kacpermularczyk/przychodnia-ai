from django.urls import path
from .views import UserAPIView
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register('register', RegisterViewSet, basename='register')
router.register('login', LoginViewSet, basename='login')
router.register('listOfVisits', ListOfVisitsViewSet, basename='listOfVisits')
router.register('visits', VisitViewSet, basename='visits')

urlpatterns = [
    path('user/', UserAPIView.as_view(), name='user'),
    path("features/", FeaturesListView.as_view(), name="features-list"),
    path("system-settings/algorithm/", SystemSettingsAlgorithmView.as_view(), name="system-settings-algorithm"),
    path("ai/retrain-rf/", RetrainRFView.as_view(), name="retrain-rf"),
    path("ai/retrain-nn/", RetrainNNView.as_view(), name="retrain-nn"),
]

urlpatterns += router.urls
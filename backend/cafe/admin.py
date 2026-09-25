from django.contrib import admin
from .models import *

for model in (Branch, StaffProfile, StaffAdjustment, StaffWorkRecord, StaffAttendance, CafeTable, TableSession, Category, MenuItem, ProductOption, AddOn, Offer, Order, OrderItem, OrderStatusHistory, Payment, Notification, StaffNote, Reservation):
    admin.site.register(model)
